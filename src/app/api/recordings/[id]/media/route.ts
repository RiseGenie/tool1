import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned, mediaUrls, transcriptFor } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ id: string }> };

/** Owner preview: fresh short-lived URLs + transcript, after an ownership check. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  if (!rec.playback_key) throw new HttpError(409, "Not playable yet");
  const urls = await mediaUrls(rec);
  const transcript = await transcriptFor(rec);
  const raw = await transcriptFor(rec, undefined, { raw: true }); // owner-only: the editor needs the unredacted text
  return NextResponse.json({
    ...urls,
    transcript: transcript.map((t) => ({ startMs: t.start_ms, endMs: t.end_ms, text: t.text })),
    transcriptRaw: raw.map((t) => ({ idx: t.idx, startMs: t.start_ms, endMs: t.end_ms, text: t.text, sourceStartMs: t.start_ms + rec.trim_start_ms })),
  });
});
