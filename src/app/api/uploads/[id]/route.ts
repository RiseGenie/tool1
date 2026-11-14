import { NextResponse } from "next/server";
import { query, one } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };

/** Resume point: which chunks the server already has. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const id = (await params).id;
  const up = await one<{ status: string; chunk_count: number | null }>(`select status, chunk_count from uploads where id=$1 and owner_id=$2`, [id, s.userId]);
  if (!up) throw new HttpError(404, "Upload not found");
  const received = await query(`select idx, size_bytes::int as size from upload_chunks where upload_id=$1 order by idx`, [id]);
  return NextResponse.json({ status: up.status, chunkCount: up.chunk_count, received });
});
