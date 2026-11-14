import { NextResponse } from "next/server";
import { handle, rateLimit } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { chunkUrl } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ id: string; idx: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, idx } = await params;
  rateLimit(`chunk-url:${s.userId}`, 600, 60_000);
  return NextResponse.json(await chunkUrl(id, Number(idx), { ownerId: s.userId }));
});
