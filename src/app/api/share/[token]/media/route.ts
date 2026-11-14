import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { handle, HttpError } from "@/lib/server/http";
import { resolveShare, playable, mediaUrls, viewerId } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ token: string }> };

/**
 * Access is checked HERE, on every call, before any storage URL is signed. URLs live for MEDIA_URL_TTL_SEC (default 300s);
 * the player asks again when one expires. After revocation this endpoint returns 404, so no fresh credentials are issued.
 */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { rec } = await resolveShare((await params).token);
  if (!playable(rec)) throw new HttpError(409, "This video is still processing", "processing");
  await viewerId(); // sets the anonymous viewer cookie
  const urls = await mediaUrls(rec);
  return NextResponse.json({ ...urls, sessionId: randomUUID() });
});
