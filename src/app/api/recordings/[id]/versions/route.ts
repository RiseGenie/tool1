import { z } from "zod";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned, publicRecording, type Recording } from "@/lib/server/recordings";
import { enqueue } from "@/lib/server/jobs";
import { getStorage, keys } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Create a replacement version as an unpublished DRAFT. It starts from this version's original upload, trim and privacy
 * edits (and a copy of the transcript), so the author can adjust/redact it, let it render, then publish.
 * The share link keeps serving the current published version until then.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { label } = z.object({ label: z.string().trim().max(80).optional() }).parse(await req.json().catch(() => ({})));
  const src = await getOwned((await params).id, s.userId);
  if (!src.source_key || src.status !== "ready") throw new HttpError(409, "The original must finish processing first");
  const id = randomUUID();
  const ext = src.source_key.split(".").pop() || "webm";
  const newKey = keys.source(id, ext);
  await getStorage().copy(src.source_key, newKey); // each version owns its source, so deleting one never breaks another

  const rec = await tx(async (c) => {
    const next = (await c.query(`select coalesce(max(version_no),0)+1 as n from recordings where series_id=$1`, [src.series_id])).rows[0].n as number;
    await c.query(
      `insert into recordings(id, owner_id, folder_id, title, status, visibility, mime_type, source_key, size_bytes, source_duration_ms, has_audio, width, height,
              trim_start_ms, trim_end_ms, thumbnail_at_ms, transcript_status, series_id, version_no, is_draft, parent_version_id, version_label, redactions)
       values ($1,$2,$3,$4,'processing',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19,$20,$21)`,
      [id, s.userId, src.folder_id, src.title, src.visibility, src.mime_type, newKey, src.size_bytes, src.source_duration_ms, src.has_audio, src.width, src.height,
       src.trim_start_ms, src.trim_end_ms, src.thumbnail_at_ms, src.transcript_status, src.series_id, next, src.id, label || `Version ${next}`, JSON.stringify(src.redactions ?? {})],
    );
    await c.query(
      `insert into transcript_segments(recording_id, idx, start_ms, end_ms, text) select $1, idx, start_ms, end_ms, text from transcript_segments where recording_id=$2`,
      [id, src.id],
    );
    await enqueue("process", id, { dedupeKey: `process:${id}:1`, client: c });
    return (await c.query<Recording>(`select * from recordings where id=$1`, [id])).rows[0];
  });
  return NextResponse.json({ recording: publicRecording(rec) }, { status: 201 });
});
