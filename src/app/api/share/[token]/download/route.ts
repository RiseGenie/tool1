import { handle, HttpError } from "@/lib/server/http";
import { resolveShare, mediaUrls, playable } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { link, rec } = await resolveShare((await params).token);
  if (!link.allow_download) throw new HttpError(403, "Downloads are turned off for this link");
  if (!playable(rec)) throw new HttpError(409, "Still processing");
  const { video } = await mediaUrls(rec, { download: true });
  return new Response(null, { status: 302, headers: { location: video, "cache-control": "no-store" } });
});
