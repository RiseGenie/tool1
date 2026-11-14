import { z } from "zod";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { enqueue } from "@/lib/server/jobs";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ chunkCount: z.number().int().min(1).max(20001), totalBytes: z.number().int().positive() });

/**
 * Idempotent finalize. The upload row is locked, so concurrent/retried calls serialize:
 *  - first call: verifies every chunk 0..n-1 is present and sizes add up, flips to processing, enqueues ONE job
 *  - repeat with the same counts: returns the same success response, creates nothing
 *  - repeat with different counts: 409
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const id = (await params).id;
  const body = schema.parse(await req.json());
  if (body.totalBytes > env.maxUploadBytes) throw new HttpError(413, "Recording is too large");
  const out = await tx(async (c) => {
    const up = (await c.query(`select * from uploads where id=$1 and owner_id=$2 for update`, [id, s.userId])).rows[0];
    if (!up) throw new HttpError(404, "Upload not found");
    if (up.status === "finalized") {
      if (up.chunk_count !== body.chunkCount || Number(up.total_bytes) !== body.totalBytes)
        throw new HttpError(409, "Upload was finalized with different contents", "finalize_conflict");
      const r = (await c.query(`select status from recordings where id=$1`, [id])).rows[0];
      return { status: r.status as string, alreadyFinalized: true };
    }
    const chunks = (await c.query(`select idx, size_bytes::bigint as size from upload_chunks where upload_id=$1 order by idx`, [id])).rows;
    if (chunks.length !== body.chunkCount) throw new HttpError(409, `Expected ${body.chunkCount} chunks, server has ${chunks.length}`, "chunks_missing");
    let sum = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].idx !== i) throw new HttpError(409, `Chunk ${i} is missing`, "chunks_missing");
      sum += Number(chunks[i].size);
    }
    if (sum !== body.totalBytes) throw new HttpError(409, "Total size does not match the uploaded chunks", "size_mismatch");
    await c.query(`update uploads set status='finalized', chunk_count=$2, total_bytes=$3, finalized_at=now() where id=$1`, [id, body.chunkCount, body.totalBytes]);
    const rec = (await c.query(
      `update recordings set status='processing', size_bytes=$2, updated_at=now() where id=$1 returning revision`,
      [id, body.totalBytes],
    )).rows[0];
    await enqueue("process", id, { dedupeKey: `process:${id}:${rec.revision}`, client: c });
    return { status: "processing", alreadyFinalized: false };
  });
  return NextResponse.json(out);
});
