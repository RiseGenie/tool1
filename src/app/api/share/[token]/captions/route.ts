import { handle, HttpError } from "@/lib/server/http";
import { resolveShare, transcriptFor } from "@/lib/server/recordings";
import { toVtt } from "@/lib/server/timeline";

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { rec } = await resolveShare((await params).token);
  if (rec.transcript_status !== "ready") throw new HttpError(404, "No captions");
  const segs = await transcriptFor(rec);
  return new Response(toVtt(segs), { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, no-store" } });
});
