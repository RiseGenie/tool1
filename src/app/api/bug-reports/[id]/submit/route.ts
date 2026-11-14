import { z } from "zod";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { attachmentUrl, attachmentsOf, buildPayload, configuredTracker, type Bug } from "@/lib/server/bugs";
import { encrypt, randomToken, sha256 } from "@/lib/server/tokens";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Sends the reviewed report to the project tracker. Requires `confirmed: true` (the author reviewed the preview).
 * Idempotent: the row is claimed atomically (draft|failed -> submitting), so a double click or retry never files two issues.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { confirmed } = z.object({ confirmed: z.literal(true, { message: "Review the preview and confirm before submitting" }) }).parse(await req.json().catch(() => ({})));
  void confirmed;
  const id = (await params).id;
  const existing = await one<Bug>(`select * from bug_reports where id=$1 and owner_id=$2`, [id, s.userId]);
  if (!existing) throw new HttpError(404, "Not found");
  if (existing.status === "submitted") return NextResponse.json({ status: "submitted", ref: existing.tracker_ref, alreadySubmitted: true });
  const tracker = configuredTracker();
  if (!tracker) throw new HttpError(409, "No bug tracker is configured. Copy the report as Markdown instead.", "no_tracker");
  if (!existing.title.trim()) throw new HttpError(400, "Add a title before submitting");
  const b = await one<Bug>(`update bug_reports set status='submitting', updated_at=now() where id=$1 and status in ('draft','failed') returning *`, [id]);
  if (!b) throw new HttpError(409, "This report is already being submitted", "in_progress");
  try {
    const atts = await attachmentsOf(id);
    let recordingUrl: string | null = null;
    if (b.include_link && b.recording_id) {
      const token = randomToken(24);
      await query(`insert into share_links(recording_id, token_hash, token_enc, allow_download, allow_comments, created_by) values ($1,$2,$3,false,true,$4)`, [b.recording_id, sha256(token), encrypt(token), s.userId]);
      await query(`update recordings set visibility='link' where id=$1`, [b.recording_id]);
      recordingUrl = `${process.env.APP_URL || new URL(req.url).origin}/s/${token}`;
    }
    const ttl = Number(process.env.BUG_ATTACHMENT_URL_TTL_SEC || 7 * 86400);
    const attachmentUrls = tracker.name === "webhook" ? await Promise.all(atts.map(async (a) => ({ filename: a.filename, url: await attachmentUrl(a.storage_key, ttl, a.filename) }))) : [];
    const out = await tracker.send(buildPayload(b, atts, recordingUrl), { reportId: id, attachmentUrls });
    await query(`update bug_reports set status='submitted', tracker=$2, tracker_ref=$3, tracker_error=null, submitted_at=now(), updated_at=now() where id=$1`, [id, tracker.name, out.ref]);
    return NextResponse.json({ status: "submitted", ref: out.ref });
  } catch (e) {
    await query(`update bug_reports set status='failed', tracker_error=$2, updated_at=now() where id=$1`, [id, (e as Error).message.slice(0, 500)]);
    throw new HttpError(502, `The tracker rejected the report: ${(e as Error).message}`, "tracker_failed");
  }
});
