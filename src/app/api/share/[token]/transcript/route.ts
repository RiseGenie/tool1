import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { resolveShare, transcriptFor } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { rec } = await resolveShare((await params).token);
  const q = new URL(req.url).searchParams.get("q") || undefined;
  const segs = await transcriptFor(rec, q);
  return NextResponse.json({
    status: rec.transcript_status,
    segments: segs.map((s) => ({ startMs: s.start_ms, endMs: s.end_ms, text: s.text })),
  });
});
