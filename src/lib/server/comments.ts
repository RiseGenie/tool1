import { one, query } from "./db";
import { HttpError, rateLimit } from "./http";
import type { Session } from "./auth";
import type { Recording } from "./recordings";
import { editToSource, mapPoint } from "./timeline";

type Row = {
  id: string; parent_id: string | null; author_id: string | null; guest_name: string | null; author_name: string | null;
  author_email: string | null; at_source_ms: number; body: string; created_at: string;
};

export async function listComments(rec: Recording) {
  const rows = await query<Row>(
    `select c.id, c.parent_id, c.author_id, c.guest_name, u.name as author_name, u.email as author_email,
            c.at_source_ms, c.body, c.created_at
       from comments c left join users u on u.id = c.author_id
      where c.recording_id = $1 and c.deleted_at is null order by c.created_at`,
    [rec.id],
  );
  return rows.map((r) => {
    const p = mapPoint(r.at_source_ms, rec);
    return {
      id: r.id,
      parentId: r.parent_id,
      atMs: p.ms,
      outsideTrim: p.outside,
      body: r.body,
      createdAt: r.created_at,
      author: {
        name: r.author_id ? r.author_name || r.author_email?.split("@")[0] || "Member" : r.guest_name || "Guest",
        verified: !!r.author_id, // signed-in account; guest names are self-declared and unverified
        isOwner: r.author_id === rec.owner_id,
      },
    };
  });
}

export async function addComment(
  rec: Recording,
  input: { atMs: number; body: string; parentId?: string | null; guestName?: string },
  actor: { session: Session | null; viewerId: string; ip: string },
) {
  rateLimit(`comment:${actor.viewerId}`, 20, 60_000);
  rateLimit(`comment-ip:${actor.ip}`, 60, 60_000);
  if (input.parentId) {
    const p = await one<{ parent_id: string | null }>(`select parent_id from comments where id=$1 and recording_id=$2 and deleted_at is null`, [input.parentId, rec.id]);
    if (!p) throw new HttpError(404, "Comment not found");
    if (p.parent_id) throw new HttpError(400, "Replies can only be one level deep");
  }
  const guestName = actor.session ? null : (input.guestName || "").trim().slice(0, 60);
  if (!actor.session && !guestName) throw new HttpError(400, "Please enter your name to comment");
  const dur = rec.duration_ms ?? Number.MAX_SAFE_INTEGER;
  const atMs = Math.max(0, Math.min(Math.round(input.atMs), dur));
  const row = await one<{ id: string }>(
    `insert into comments(recording_id, parent_id, author_id, guest_name, viewer_id, at_source_ms, body)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [rec.id, input.parentId ?? null, actor.session?.userId ?? null, guestName, actor.viewerId, editToSource(atMs, rec), input.body.trim()],
  );
  return row!.id;
}
