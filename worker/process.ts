import { createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { one, query, tx } from "../src/lib/server/db";
import { enqueue, type Job } from "../src/lib/server/jobs";
import { getStorage, keys } from "../src/lib/server/storage";
import { env } from "../src/lib/server/env";
import { extractAudioPieces, extractThumbnail, measureDurationMs, probe, transcodeToMp4 } from "./ffmpeg";
import { getTranscriber } from "./transcribe";
import { normalizeRedactions } from "../src/lib/server/redactions";

type Rec = {
  id: string; revision: number; mime_type: string | null; source_key: string | null; source_duration_ms: number | null;
  trim_start_ms: number; trim_end_ms: number | null; thumbnail_at_ms: number | null; playback_key: string | null;
  transcript_status: string; has_audio: boolean | null; duration_ms: number | null; redactions: unknown;
};

const ext = (mime: string | null) => (mime?.includes("mp4") ? "mp4" : mime?.includes("matroska") ? "mkv" : "webm");

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "rg-job-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Concatenate the uploaded chunks (in index order) into one source file. Idempotent: skipped once source_key is set. */
async function assembleSource(rec: Rec, dir: string): Promise<string> {
  const st = getStorage();
  const local = join(dir, `source.${ext(rec.mime_type)}`);
  if (rec.source_key) {
    await st.downloadTo(rec.source_key, local);
    return local;
  }
  const up = await one<{ total_bytes: string; chunk_count: number }>(`select total_bytes, chunk_count from uploads where id=$1 and status='finalized'`, [rec.id]);
  if (!up) throw new Error("Upload is not finalized");
  const out = createWriteStream(local);
  for (let i = 0; i < up.chunk_count; i++) {
    const rs = await st.readStream(keys.chunk(rec.id, i));
    await pipeline(rs, out, { end: false });
  }
  await new Promise<void>((r, j) => out.end((e: Error | null | undefined) => (e ? j(e) : r())));
  const size = (await stat(local)).size;
  if (size !== Number(up.total_bytes)) throw new Error(`Assembled ${size} bytes, expected ${up.total_bytes}`);
  const key = keys.source(rec.id, ext(rec.mime_type));
  await st.uploadFrom(local, key, rec.mime_type || "video/webm");
  await query(`update recordings set source_key=$2, updated_at=now() where id=$1`, [rec.id, key]);
  rec.source_key = key;
  // Chunks are redundant now; remove them (best effort, a leftover chunk is harmless).
  await Promise.allSettled(Array.from({ length: up.chunk_count }, (_, i) => st.remove(keys.chunk(rec.id, i))));
  return local;
}

async function loadRec(id: string) {
  return one<Rec>(`select * from recordings where id=$1 and deleted_at is null`, [id]);
}

export async function processJob(job: Job): Promise<void> {
  const rec = await loadRec(job.recording_id);
  if (!rec) return; // deleted while queued
  const st = getStorage();

  if (job.payload.thumbOnly) {
    if (!rec.playback_key) return;
    await withTmp(async (dir) => {
      const play = join(dir, "play.mp4");
      await st.downloadTo(rec.playback_key!, play);
      const dur = rec.duration_ms ?? 1000;
      const at = Math.min(rec.thumbnail_at_ms ?? Math.min(1000, dur / 2), Math.max(0, dur - 100));
      const out = join(dir, "thumb.jpg");
      await extractThumbnail(play, out, at);
      const key = keys.thumb(rec.id, rec.revision);
      await st.uploadFrom(out, key, "image/jpeg");
      await query(`update recordings set thumbnail_key=$2, updated_at=now() where id=$1 and revision=$3`, [rec.id, key, rec.revision]);
    });
    return;
  }

  const rev = rec.revision;
  await withTmp(async (dir) => {
    const src = await assembleSource(rec, dir);
    const meta = await probe(src);
    const sourceMs = rec.source_duration_ms ?? (await measureDurationMs(src));

    const start = Math.min(rec.trim_start_ms, Math.max(0, sourceMs - 500));
    const end = rec.trim_end_ms !== null ? Math.min(rec.trim_end_ms, sourceMs) : null;
    const play = join(dir, "playback.mp4");
    // Privacy edits are stored on the source timeline; map them onto the trimmed output timeline.
    const red = normalizeRedactions(rec.redactions);
    const outLen = ((end ?? sourceMs) - start) / 1000;
    const shift = (ms: number) => Math.max(0, (ms - start) / 1000);
    const live = <T extends { startMs: number; endMs: number }>(r: T) => r.endMs > start && (end === null || r.startMs < end) && shift(r.startMs) < outLen;
    const blurs = red.blurs.filter(live).map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, s: shift(b.startMs), e: shift(b.endMs) }));
    const mutes = red.mutes.filter(live).map((m) => ({ s: shift(m.startMs), e: shift(m.endMs) }));
    await transcodeToMp4({ src, out: play, startMs: start, endMs: end, hasAudio: meta.hasAudio, blurs, mutes });
    const out = await probe(play);
    if (!out.durationMs) throw new Error("Processed video has no duration");

    const thumbAt = Math.min(rec.thumbnail_at_ms ?? Math.min(1000, out.durationMs / 2), Math.max(0, out.durationMs - 100));
    const thumb = join(dir, "thumb.jpg");
    await extractThumbnail(play, thumb, thumbAt);

    const playKey = keys.playback(rec.id, rev);
    const thumbKey = keys.thumb(rec.id, rev);
    await st.uploadFrom(play, playKey, "video/mp4");
    await st.uploadFrom(thumb, thumbKey, "image/jpeg");

    const transcriptStatus = !meta.hasAudio ? "none" : env.transcribe.provider === "none" ? "disabled" : null;
    const committed = await tx(async (c) => {
      const r = await c.query(
        `update recordings set playback_key=$2, thumbnail_key=$3, duration_ms=$4, source_duration_ms=$5, width=$6, height=$7,
                has_audio=$8, status='ready', failure_reason=null, updated_at=now(),
                transcript_status = case when transcript_status in ('ready','processing') then transcript_status else coalesce($9, 'queued') end
          where id=$1 and revision=$10 returning transcript_status`,
        [rec.id, playKey, thumbKey, out.durationMs, sourceMs, out.width, out.height, meta.hasAudio, transcriptStatus, rev],
      );
      if (!r.rowCount) return false; // a newer revision superseded this render
      if (r.rows[0].transcript_status === "queued") await enqueue("transcribe", rec.id, { dedupeKey: `transcribe:${rec.id}`, client: c });
      return true;
    });
    if (!committed) {
      await Promise.allSettled([st.remove(playKey), st.remove(thumbKey)]);
      return;
    }
    // Remove files from earlier revisions now that the new one is live.
    await Promise.allSettled(Array.from({ length: rev - 1 }, (_, i) => [st.remove(keys.playback(rec.id, i + 1)), st.remove(keys.thumb(rec.id, i + 1))]).flat());
  });
}

export async function transcribeJob(job: Job): Promise<void> {
  const rec = await loadRec(job.recording_id);
  if (!rec || !rec.source_key) return;
  const provider = getTranscriber();
  if (!provider) {
    await query(`update recordings set transcript_status='disabled' where id=$1`, [rec.id]);
    return;
  }
  await query(`update recordings set transcript_status='processing', transcript_error=null where id=$1`, [rec.id]);
  await withTmp(async (dir) => {
    const src = join(dir, `source.${ext(rec.mime_type)}`);
    await getStorage().downloadTo(rec.source_key!, src);
    const pieces = await extractAudioPieces(src, dir);
    const all: { startMs: number; endMs: number; text: string }[] = [];
    const sourceMs = rec.source_duration_ms ?? 0;
    for (let i = 0; i < pieces.length; i++) {
      const offset = i * 600_000;
      const segs = await provider.transcribe(pieces[i], Math.min(600_000, Math.max(1000, sourceMs - offset)));
      for (const s of segs) all.push({ startMs: s.startMs + offset, endMs: s.endMs + offset, text: s.text });
    }
    await tx(async (c) => {
      await c.query(`delete from transcript_segments where recording_id=$1`, [rec.id]);
      for (let i = 0; i < all.length; i++)
        await c.query(`insert into transcript_segments(recording_id, idx, start_ms, end_ms, text) values ($1,$2,$3,$4,$5)`, [rec.id, i, all[i].startMs, all[i].endMs, all[i].text]);
      await c.query(`update recordings set transcript_status = $2, updated_at=now() where id=$1`, [rec.id, all.length ? "ready" : "none"]);
    });
  });
}

/** Called when a job has exhausted its retries: surface the failure on the recording so the UI can offer Retry. */
export async function markFailed(job: Job, err: unknown) {
  const msg = (err instanceof Error ? err.message : String(err)).slice(0, 500);
  if (job.kind === "process") await query(`update recordings set status='failed', failure_reason=$2, updated_at=now() where id=$1`, [job.recording_id, msg]);
  else await query(`update recordings set transcript_status='failed', transcript_error=$2 where id=$1`, [job.recording_id, msg]);
}
