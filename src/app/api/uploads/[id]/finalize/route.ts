import { z } from "zod";
import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { finalize } from "@/lib/server/uploads";
import { kick } from "@/lib/server/inline-worker";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ chunkCount: z.number().int().min(1).max(20001), totalBytes: z.number().int().positive() });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const out = await finalize((await params).id, schema.parse(await req.json()), { ownerId: s.userId });
  kick(); // start processing right after the response, in this same invocation (INLINE_WORKER=1)
  return NextResponse.json(out);
});
