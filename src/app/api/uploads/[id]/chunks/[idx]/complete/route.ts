import { z } from "zod";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getStorage, keys } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string; idx: string }> };
const schema = z.object({ size: z.number().int().positive() });

/** Records a chunk only after verifying the object really exists in storage with the expected size. Idempotent. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, idx: idxStr } = await params;
  const idx = Number(idxStr);
  if (!Number.isInteger(idx) || idx < 0 || idx > 20000) throw new HttpError(400, "Bad chunk index");
  const { size } = schema.parse(await req.json());
  const up = await one<{ status: string }>(`select status from uploads where id=$1 and owner_id=$2`, [id, s.userId]);
  if (!up) throw new HttpError(404, "Upload not found");
  if (up.status !== "open") throw new HttpError(409, "Upload already finalized");
  const head = await getStorage().head(keys.chunk(id, idx));
  if (!head) throw new HttpError(409, "Chunk is not in storage yet", "chunk_missing");
  if (head.size !== size) throw new HttpError(409, `Chunk size mismatch (stored ${head.size}, expected ${size})`, "chunk_size_mismatch");
  await query(
    `insert into upload_chunks(upload_id, idx, size_bytes) values ($1,$2,$3)
     on conflict (upload_id, idx) do update set size_bytes = excluded.size_bytes`,
    [id, idx, size],
  );
  return NextResponse.json({ ok: true });
});
