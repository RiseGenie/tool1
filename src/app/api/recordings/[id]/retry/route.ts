import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { enqueue } from "@/lib/server/jobs";

type Ctx = { params: Promise<{ id: string }> };

/** Re-queue failed processing and/or transcription. Safe to call repeatedly (jobs are deduplicated). */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  if (rec.status === "failed") {
    await query(`update recordings set status='processing', failure_reason=null, updated_at=now() where id=$1`, [rec.id]);
    await enqueue("process", rec.id, { dedupeKey: `process:${rec.id}:${rec.revision}` });
  } else if (rec.transcript_status === "failed") {
    await query(`update recordings set transcript_status='queued', transcript_error=null where id=$1`, [rec.id]);
    await enqueue("transcribe", rec.id, { dedupeKey: `transcribe:${rec.id}` });
  } else throw new HttpError(409, "Nothing to retry");
  return NextResponse.json({ ok: true });
});
