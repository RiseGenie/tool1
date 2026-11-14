import { z } from "zod";
import { NextResponse } from "next/server";
import { clientIp, handle, rateLimit } from "@/lib/server/http";
import { MAX_REQUEST_BYTES, resolveRequest } from "@/lib/server/requests";
import { chunkComplete } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ token: string; id: string; idx: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { token, id, idx } = await params;
  rateLimit(`rq-chunk:${clientIp(req)}`, 600, 60_000);
  const r = await resolveRequest(token, { upload: true });
  const { size } = z.object({ size: z.number().int().positive() }).parse(await req.json());
  await chunkComplete(id, Number(idx), size, { ownerId: r.owner_id, requestId: r.id, sniff: true, maxBytes: MAX_REQUEST_BYTES });
  return NextResponse.json({ ok: true });
});
