import { z } from "zod";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { handle, HttpError, rateLimit } from "@/lib/server/http";
import { getSession } from "@/lib/server/auth";
import { resolveShare, viewerId } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({ sessionId: z.string().uuid(), watchedMs: z.number().int().min(0).max(86_400_000) });

/** View-counting rule (see README "Views"): a view = one player session with >= 3s of real playback, at most one per viewer per recording per 24h, owner excluded. */
const VIEW_MIN_WATCHED_MS = 3000;

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { rec } = await resolveShare((await params).token);
  const b = schema.parse(await req.json());
  const vid = await viewerId();
  rateLimit(`hb:${b.sessionId}`, 120, 60_000);
  const session = await getSession().catch(() => null);
  const isOwner = session?.userId === rec.owner_id;

  const result = await tx(async (c) => {
    await c.query(
      `insert into view_sessions(session_id, recording_id, viewer_id) values ($1,$2,$3) on conflict (session_id) do nothing`,
      [b.sessionId, rec.id, vid],
    );
    const vs = (await c.query(`select * from view_sessions where session_id=$1 for update`, [b.sessionId])).rows[0];
    if (vs.recording_id !== rec.id || vs.viewer_id !== vid) throw new HttpError(403, "Session mismatch");
    // A client can't claim more playback than wall-clock time since the session began (+ slack), which blocks inflated counts.
    const elapsed = Date.now() - new Date(vs.first_seen).getTime() + 2000;
    const watched = Math.max(vs.watched_ms, Math.min(b.watchedMs, elapsed));
    let counted = !!vs.counted_at;
    if (!counted && !isOwner && watched >= VIEW_MIN_WATCHED_MS) {
      const recent = await c.query(
        `select 1 from view_sessions where recording_id=$1 and viewer_id=$2 and counted_at > now() - interval '24 hours' limit 1`,
        [rec.id, vid],
      );
      if (!recent.rowCount) {
        await c.query(`update view_sessions set counted_at = now() where session_id=$1`, [b.sessionId]);
        await c.query(`update recordings set view_count = view_count + 1 where id=$1`, [rec.id]);
        counted = true;
      }
    }
    await c.query(`update view_sessions set watched_ms=$2, last_seen=now() where session_id=$1`, [b.sessionId, watched]);
    return { watchedMs: watched, counted };
  });
  return NextResponse.json(result);
});
