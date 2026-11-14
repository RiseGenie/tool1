import { z } from "zod";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { encrypt, decrypt, randomToken, sha256 } from "@/lib/server/tokens";
import type { VideoRequest } from "@/lib/server/requests";

const appUrl = (req: Request) => process.env.APP_URL || new URL(req.url).origin;
const schema = z.object({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(2000).default(""),
  expiresInDays: z.number().min(0.01).max(90).default(7),
  maxSubmissions: z.number().int().min(1).max(100).default(10),
  allowScreen: z.boolean().default(true),
  allowCamera: z.boolean().default(true),
  allowUpload: z.boolean().default(true),
  folderId: z.string().uuid().nullable().optional(),
});

export const view = (r: VideoRequest, count: number, req: Request) => {
  const expired = new Date(r.expires_at).getTime() < Date.now();
  return {
    id: r.id, title: r.title, instructions: r.instructions, expiresAt: r.expires_at, maxSubmissions: r.max_submissions, submissions: count,
    allowScreen: r.allow_screen, allowCamera: r.allow_camera, allowUpload: r.allow_upload, folderId: r.folder_id, createdAt: r.created_at,
    status: r.closed_at ? "closed" : expired ? "expired" : count >= r.max_submissions ? "full" : "active",
    url: r.closed_at ? null : `${appUrl(req)}/r/${decrypt(r.token_enc)}`,
  };
};

export const POST = handle(async (req: Request) => {
  const s = await requireSession();
  const b = schema.parse(await req.json());
  if (!b.allowScreen && !b.allowCamera && !b.allowUpload) throw new HttpError(400, "Allow at least one way to respond");
  if (b.folderId && !(await one(`select 1 as x from folders where id=$1 and owner_id=$2`, [b.folderId, s.userId]))) throw new HttpError(404, "Folder not found");
  const token = randomToken(24);
  const r = await one<VideoRequest>(
    `insert into video_requests(owner_id, title, instructions, token_hash, token_enc, expires_at, max_submissions, allow_screen, allow_camera, allow_upload, folder_id)
     values ($1,$2,$3,$4,$5, now() + ($6 || ' seconds')::interval, $7,$8,$9,$10,$11) returning *`,
    [s.userId, b.title, b.instructions, sha256(token), encrypt(token), String(Math.round(b.expiresInDays * 86400)), b.maxSubmissions, b.allowScreen, b.allowCamera, b.allowUpload, b.folderId ?? null],
  );
  return NextResponse.json({ request: view(r!, 0, req) }, { status: 201 });
});

export const GET = handle(async (req: Request) => {
  const s = await requireSession();
  const rows = await query<VideoRequest & { n: number }>(
    `select v.*, (select count(*)::int from recordings r where r.request_id = v.id and (r.status <> 'uploading' or r.created_at > now() - interval '1 hour')) as n from video_requests v where v.owner_id=$1 order by v.created_at desc limit 100`,
    [s.userId],
  );
  return NextResponse.json({ requests: rows.map((r) => view(r, r.n, req)) });
});
