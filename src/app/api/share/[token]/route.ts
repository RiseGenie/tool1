import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { resolveShare, playable } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { link, rec } = await resolveShare((await params).token);
  return NextResponse.json({
    title: rec.title,
    status: rec.status,
    playable: playable(rec),
    durationMs: rec.duration_ms,
    allowDownload: link.allow_download,
    allowComments: link.allow_comments,
    transcriptStatus: rec.transcript_status,
    revision: rec.revision,
  });
});
