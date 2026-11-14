import { z } from "zod";
import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { chunkComplete } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ id: string; idx: string }> };

/** Records a chunk only after verifying the object really exists in storage with the expected size. Idempotent. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, idx } = await params;
  const { size } = z.object({ size: z.number().int().positive() }).parse(await req.json());
  await chunkComplete(id, Number(idx), size, { ownerId: s.userId });
  return NextResponse.json({ ok: true });
});
