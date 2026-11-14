import { z } from "zod";
import { NextResponse } from "next/server";
import { query, one } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned, linkToken } from "@/lib/server/recordings";
import { encrypt, randomToken, sha256 } from "@/lib/server/tokens";

type Ctx = { params: Promise<{ id: string }> };
const appUrl = (req: Request) => process.env.APP_URL || new URL(req.url).origin;

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const rows = await query<{ id: string; allow_download: boolean; allow_comments: boolean; created_at: string; revoked_at: string | null; token_enc: string }>(
    `select id, allow_download, allow_comments, created_at, revoked_at, token_enc from share_links where recording_id=$1 order by created_at desc`,
    [rec.id],
  );
  return NextResponse.json({
    links: rows.map((l) => ({
      id: l.id,
      allowDownload: l.allow_download,
      allowComments: l.allow_comments,
      createdAt: l.created_at,
      revokedAt: l.revoked_at,
      url: l.revoked_at ? null : `${appUrl(req)}/s/${linkToken(l)}`,
    })),
  });
});

const createSchema = z.object({ allowDownload: z.boolean().default(false), allowComments: z.boolean().default(true) });

/** Creates a link and turns the recording's visibility to "link". */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const body = createSchema.parse(await req.json().catch(() => ({})));
  const token = randomToken(24);
  const row = await one<{ id: string }>(
    `insert into share_links(recording_id, token_hash, token_enc, allow_download, allow_comments, created_by)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [rec.id, sha256(token), encrypt(token), body.allowDownload, body.allowComments, s.userId],
  );
  await query(`update recordings set visibility='link', updated_at=now() where id=$1`, [rec.id]);
  return NextResponse.json({ id: row!.id, url: `${appUrl(req)}/s/${token}` }, { status: 201 });
});
