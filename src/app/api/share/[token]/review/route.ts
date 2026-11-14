import { z } from "zod";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { handle, HttpError, clientIp, rateLimit } from "@/lib/server/http";
import { getSession } from "@/lib/server/auth";
import { resolveShare } from "@/lib/server/recordings";
import { reviewHistory, statusOf, publicDecision, type Decision } from "@/lib/server/review";
import { editToSource } from "@/lib/server/timeline";

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { rec } = await resolveShare((await params).token);
  const history = await reviewHistory(rec.series_id, { includeDrafts: false });
  const current = history.find((h) => h.id === rec.id)!;
  return NextResponse.json({ currentVersion: { versionNo: rec.version_no, label: rec.version_label }, status: current.status, decisions: current.decisions, history });
});

const schema = z.object({
  decision: z.enum(["approved", "changes_requested"]),
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  note: z.string().trim().max(2000).optional(),
  atMs: z.number().min(0).optional(),
});

/**
 * Approve / request changes for the CURRENT published version only. The decision is stored against that exact version
 * (and render revision) and freezes it, so "approved" can never silently change meaning after a later edit.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { link, rec } = await resolveShare((await params).token);
  if (!link.allow_comments) throw new HttpError(403, "Reviews are turned off for this link");
  if (rec.status !== "ready") throw new HttpError(409, "This version isn’t ready for review yet");
  const b = schema.parse(await req.json());
  rateLimit(`review:${clientIp(req)}`, 30, 60_000);
  const session = await getSession().catch(() => null);
  const name = session ? session.name || session.email.split("@")[0] : b.name;
  if (!name) throw new HttpError(400, "Please enter your name");
  if (b.decision === "changes_requested" && !b.note?.trim() && b.atMs === undefined) throw new HttpError(400, "Tell us what should change");

  const out = await tx(async (c) => {
    const cur = (await c.query(`select id, revision, duration_ms, trim_start_ms, locked_at, is_draft from recordings where id=$1 for update`, [rec.id])).rows[0];
    if (!cur || cur.is_draft) throw new HttpError(404, "Not found");
    if (cur.revision !== rec.revision) throw new HttpError(409, "This video was just updated — reload to review the latest.");
    const d = (await c.query<Decision>(
      `insert into review_decisions(recording_id, revision, decision, reviewer_user_id, reviewer_name, reviewer_email, verified, note)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [rec.id, cur.revision, b.decision, session?.userId ?? null, name, session?.email ?? (b.email || null), !!session, b.note || null],
    )).rows[0];
    await c.query(`update recordings set locked_at = coalesce(locked_at, now()) where id=$1`, [rec.id]);
    if (b.decision === "changes_requested") {
      const at = Math.max(0, Math.min(Math.round(b.atMs ?? 0), cur.duration_ms ?? 0));
      await c.query(
        `insert into comments(recording_id, kind, author_id, guest_name, viewer_id, at_source_ms, body) values ($1,'change_request',$2,$3,$4,$5,$6)`,
        [rec.id, session?.userId ?? null, session ? null : name, session?.userId ?? `review:${clientIp(req)}`, editToSource(at, rec), b.note?.trim() || "Changes requested"],
      );
    }
    const all = (await c.query<Decision>(`select * from review_decisions where recording_id=$1 order by created_at`, [rec.id])).rows;
    return { decision: publicDecision(d), status: statusOf(all) };
  });
  return NextResponse.json(out, { status: 201 });
});
