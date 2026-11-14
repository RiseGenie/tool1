import { z } from "zod";
import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ allowDownload: z.boolean().optional(), allowComments: z.boolean().optional(), revoked: z.literal(true).optional() });

/** Edit link permissions or revoke it. Revocation is permanent: create a new link to share again. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const id = (await params).id;
  const b = schema.parse(await req.json());
  const rows = await query(
    `update share_links l set
        allow_download = coalesce($3, l.allow_download),
        allow_comments = coalesce($4, l.allow_comments),
        revoked_at = case when $5::boolean then coalesce(l.revoked_at, now()) else l.revoked_at end
       from recordings r
      where l.id = $1 and r.id = l.recording_id and r.owner_id = $2
      returning l.id`,
    [id, s.userId, b.allowDownload ?? null, b.allowComments ?? null, b.revoked === true],
  );
  if (!rows.length) throw new HttpError(404, "Link not found");
  return NextResponse.json({ ok: true });
});
