import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned, transcriptFor } from "@/lib/server/recordings";
import { toVtt } from "@/lib/server/timeline";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  if (rec.transcript_status !== "ready") throw new HttpError(404, "No captions");
  return new Response(toVtt(await transcriptFor(rec)), { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "private, no-store" } });
});
