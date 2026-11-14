import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned, publicRecording } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ id: string }> };

/** Publishing makes this version the one every share link serves. Earlier versions (and their decisions) stay in the history. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  if (!rec.is_draft) return NextResponse.json({ recording: publicRecording(rec) }); // idempotent
  if (rec.status !== "ready" || !rec.playback_key) throw new HttpError(409, "Wait for the version to finish rendering before publishing");
  // Inherit the sharing state of the version being replaced (a private series stays private).
  await query(
    `update recordings set is_draft=false, updated_at=now(),
            visibility = coalesce((select visibility from recordings where series_id=$2 and not is_draft and deleted_at is null order by version_no desc limit 1), visibility)
      where id=$1`,
    [rec.id, rec.series_id],
  );
  const out = await getOwned(rec.id, s.userId);
  return NextResponse.json({ recording: publicRecording(out) });
});
