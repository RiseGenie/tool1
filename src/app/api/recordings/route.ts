import { z } from "zod";
import { NextResponse } from "next/server";
import { query, tx } from "@/lib/server/db";
import { handle, HttpError, rateLimit } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getStorage } from "@/lib/server/storage";
import { publicRecording, MEDIA_TTL_SEC, type Recording } from "@/lib/server/recordings";

const MIME = /^video\/(webm|mp4|x-matroska)$/;

const createSchema = z.object({
  id: z.string().uuid(),
  mimeType: z.string().transform((s) => s.split(";")[0].trim()).refine((s) => MIME.test(s), "Unsupported video type"),
  title: z.string().trim().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

/** Idempotent: calling twice with the same id returns the same recording and the chunks already received. */
export const POST = handle(async (req: Request) => {
  const s = await requireSession();
  rateLimit(`rec-create:${s.userId}`, 60, 60_000);
  const body = createSchema.parse(await req.json());
  const out = await tx(async (c) => {
    if (body.folderId) {
      const f = await c.query(`select 1 from folders where id=$1 and owner_id=$2`, [body.folderId, s.userId]);
      if (!f.rowCount) throw new HttpError(404, "Folder not found");
    }
    const title = body.title ?? `Recording ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    await c.query(
      `insert into recordings(id, owner_id, title, mime_type, folder_id) values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [body.id, s.userId, title, body.mimeType, body.folderId ?? null],
    );
    const rec = (await c.query<Recording>(`select * from recordings where id=$1`, [body.id])).rows[0];
    if (rec.owner_id !== s.userId) throw new HttpError(409, "Recording id already in use");
    await c.query(
      `insert into uploads(id, recording_id, owner_id, mime_type) values ($1,$1,$2,$3) on conflict (id) do nothing`,
      [body.id, s.userId, body.mimeType],
    );
    const chunks = (await c.query(`select idx, size_bytes::int as size from upload_chunks where upload_id=$1 order by idx`, [body.id])).rows;
    const up = (await c.query(`select status from uploads where id=$1`, [body.id])).rows[0];
    return { rec, chunks, uploadStatus: up.status as string };
  });
  return NextResponse.json({ recording: publicRecording(out.rec), received: out.chunks, uploadStatus: out.uploadStatus }, { status: 200 });
});

export const GET = handle(async (req: Request) => {
  const s = await requireSession();
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") || "all";
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const params: unknown[] = [s.userId];
  let where = `r.owner_id = $1 and r.deleted_at is null`;
  if (folder === "root") where += ` and r.folder_id is null`;
  else if (folder !== "all") {
    if (!/^[0-9a-f-]{36}$/.test(folder)) throw new HttpError(400, "Bad folder");
    params.push(folder);
    where += ` and r.folder_id = $${params.length}`;
  }
  if (q) {
    params.push(q);
    const i = params.length;
    where += ` and (r.title ilike '%' || $${i} || '%' or exists (
      select 1 from transcript_segments t where t.recording_id = r.id
        and (t.tsv @@ websearch_to_tsquery('english', $${i}) or t.text ilike '%' || $${i} || '%')))`;
  }
  const rows = await query<Recording>(`select r.* from recordings r where ${where} order by r.created_at desc limit 200`, params);
  const st = getStorage();
  const items = await Promise.all(
    rows.map(async (r) => ({
      ...publicRecording(r),
      thumbnailUrl: r.thumbnail_key ? await st.presignGet(r.thumbnail_key, { ttlSec: MEDIA_TTL_SEC, contentType: "image/jpeg" }) : null,
    })),
  );
  let matches: Record<string, { startMs: number; text: string }[]> = {};
  if (q && rows.length) {
    const m = await query<{ recording_id: string; start_ms: number; text: string; trim_start_ms: number; trim_end_ms: number | null }>(
      `select t.recording_id, t.start_ms, t.text, r.trim_start_ms, r.trim_end_ms
         from transcript_segments t join recordings r on r.id = t.recording_id
        where t.recording_id = any($1) and (t.tsv @@ websearch_to_tsquery('english', $2) or t.text ilike '%' || $2 || '%')
        order by t.recording_id, t.start_ms`,
      [rows.map((r) => r.id), q],
    );
    matches = {};
    for (const x of m) {
      if (x.start_ms < x.trim_start_ms || (x.trim_end_ms !== null && x.start_ms > x.trim_end_ms)) continue;
      (matches[x.recording_id] ||= []).length < 3 &&
        matches[x.recording_id].push({ startMs: x.start_ms - x.trim_start_ms, text: x.text });
    }
  }
  const folders = await query(
    `select f.id, f.name, count(r.id)::int as count from folders f
       left join recordings r on r.folder_id = f.id and r.deleted_at is null
      where f.owner_id = $1 group by f.id order by f.name`,
    [s.userId],
  );
  return NextResponse.json({ items, matches, folders });
});
