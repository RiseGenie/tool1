import { z } from "zod";
import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { MAX_REQUEST_BYTES, resolveRequest } from "@/lib/server/requests";
import { finalize } from "@/lib/server/uploads";
import { kick } from "@/lib/server/inline-worker";

export const maxDuration = 300;

type Ctx = { params: Promise<{ token: string; id: string }> };
const schema = z.object({ chunkCount: z.number().int().min(1).max(20001), totalBytes: z.number().int().positive() });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { token, id } = await params;
  const r = await resolveRequest(token, { upload: true });
  const out = await finalize(id, schema.parse(await req.json()), { ownerId: r.owner_id, requestId: r.id, maxBytes: MAX_REQUEST_BYTES });
  kick();
  return NextResponse.json(out);
});
