import { z } from "zod";
import { NextResponse } from "next/server";
import { query, tx } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned, publicRecording, type Recording } from "@/lib/server/recordings";
import { enqueue } from "@/lib/server/jobs";
import { needsRender, normalizeRedactions, redactionsSchema } from "@/lib/server/redactions";
import { getStorage } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  visibility: z.enum(["private", "link"]).optional(),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(1).nullable().optional(),
  thumbnailAtMs: z.number().int().min(0).nullable().optional(),
  redactions: redactionsSchema.optional(),
});

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const links = await query(
    `select id, allow_download, allow_comments, created_at, revoked_at from share_links where recording_id=$1 order by created_at desc`,
    [rec.id],
  );
  return NextResponse.json({ recording: publicRecording(rec), links });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const body = patchSchema.parse(await req.json());
  const id = (await params).id;
  const result = await tx(async (c) => {
    const rec = (await c.query<Recording>(`select * from recordings where id=$1 and owner_id=$2 and deleted_at is null for update`, [id, s.userId])).rows[0];
    if (!rec) throw new HttpError(404, "Not found");
    if (body.folderId) {
      const f = await c.query(`select 1 from folders where id=$1 and owner_id=$2`, [body.folderId, s.userId]);
      if (!f.rowCount) throw new HttpError(404, "Folder not found");
    }
    const sets: string[] = [];
    const vals: unknown[] = [];
    const set = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (body.title !== undefined) set("title", body.title);
    if (body.folderId !== undefined) set("folder_id", body.folderId);
    if (body.visibility !== undefined) set("visibility", body.visibility);

    let rerender = false;
    let thumbOnly = false;
    const trimChanged = body.trimStartMs !== undefined || body.trimEndMs !== undefined;
    const contentEdit = trimChanged || body.redactions !== undefined;
    if (contentEdit && rec.locked_at)
      throw new HttpError(409, "This version has been reviewed and is locked. Create a new version to change it.", "version_locked");
    if (body.redactions !== undefined) {
      const old = normalizeRedactions(rec.redactions);
      if (rec.source_duration_ms && [...body.redactions.blurs, ...body.redactions.mutes].some((r) => r.endMs > rec.source_duration_ms! + 250))
        throw new HttpError(400, "A redaction extends past the end of the recording");
      set("redactions", JSON.stringify(body.redactions));
      if (needsRender(old, body.redactions)) {
        if (!rec.source_duration_ms) throw new HttpError(409, "Editing is available once processing finishes");
        rerender = true;
      }
    }
    if (trimChanged) {
      if (!rec.source_duration_ms) throw new HttpError(409, "Trimming is available once processing finishes");
      const start = body.trimStartMs ?? rec.trim_start_ms;
      const end = body.trimEndMs === undefined ? rec.trim_end_ms : body.trimEndMs;
      const effEnd = end ?? rec.source_duration_ms;
      if (effEnd > rec.source_duration_ms + 250) throw new HttpError(400, "Trim end is past the end of the recording");
      if (effEnd - start < 500) throw new HttpError(400, "The trimmed video must be at least 0.5 seconds long");
      if (start !== rec.trim_start_ms || end !== rec.trim_end_ms) {
        set("trim_start_ms", start);
        set("trim_end_ms", end);
        rerender = true;
      }
    }
    if (body.thumbnailAtMs !== undefined && body.thumbnailAtMs !== rec.thumbnail_at_ms) {
      set("thumbnail_at_ms", body.thumbnailAtMs);
      if (!rerender) thumbOnly = true;
    }
    if (rerender) {
      // Privacy-first: stop serving the old (untrimmed) playback file the moment a trim is saved.
      sets.push(`revision = revision + 1`, `playback_key = null`, `status = 'processing'`, `failure_reason = null`);
    }
    if (sets.length) {
      await c.query(`update recordings set ${sets.join(", ")}, updated_at = now() where id = $${vals.length + 1}`, [...vals, id]);
    }
    const next = (await c.query<Recording>(`select * from recordings where id=$1`, [id])).rows[0];
    if (rerender) await enqueue("process", id, { dedupeKey: `process:${id}:${next.revision}`, client: c });
    else if (thumbOnly && rec.playback_key) await enqueue("process", id, { payload: { thumbOnly: true }, dedupeKey: `thumb:${id}:${body.thumbnailAtMs}`, client: c });
    return { next, oldPlayback: rerender ? rec.playback_key : null, oldThumb: rerender ? rec.thumbnail_key : null };
  });
  void result.oldPlayback; // old revision files are deleted by the worker once the new revision is in place
  return NextResponse.json({ recording: publicRecording(result.next) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const st = getStorage();
  const chunkRows = await query<{ idx: number }>(`select idx from upload_chunks where upload_id=$1`, [rec.id]);
  const { keys } = await import("@/lib/server/storage");
  const objs = [rec.source_key, rec.playback_key, rec.thumbnail_key, ...chunkRows.map((c) => keys.chunk(rec.id, c.idx))].filter(Boolean) as string[];
  // If other versions survive, keep the series' share links alive by re-pointing them before the cascade.
  const survivor = await query<{ id: string }>(`select id from recordings where series_id=$1 and id<>$2 and deleted_at is null order by version_no desc limit 1`, [rec.series_id, rec.id]);
  if (survivor[0]) await query(`update share_links set recording_id=$1 where recording_id=$2`, [survivor[0].id, rec.id]);
  await query(`delete from recordings where id=$1`, [rec.id]); // cascades comments, transcript, decisions, jobs, uploads
  await Promise.allSettled(objs.map((k) => st.remove(k)));
  return NextResponse.json({ ok: true });
});
