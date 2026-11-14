import { NextResponse } from "next/server";
import { one } from "@/lib/server/db";
import { handle, HttpError, rateLimit } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getStorage, keys } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string; idx: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, idx: idxStr } = await params;
  const idx = Number(idxStr);
  if (!Number.isInteger(idx) || idx < 0 || idx > 20000) throw new HttpError(400, "Bad chunk index");
  rateLimit(`chunk-url:${s.userId}`, 600, 60_000);
  const up = await one<{ status: string }>(`select status from uploads where id=$1 and owner_id=$2`, [id, s.userId]);
  if (!up) throw new HttpError(404, "Upload not found");
  if (up.status !== "open") throw new HttpError(409, "Upload already finalized");
  const signed = await getStorage().presignPut(keys.chunk(id, idx), 900);
  return NextResponse.json(signed);
});
