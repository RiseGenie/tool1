import { z } from "zod";
import { NextResponse } from "next/server";
import { one } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import type { VideoRequest } from "@/lib/server/requests";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ closed: z.boolean().optional(), extendDays: z.number().min(0.01).max(90).optional(), maxSubmissions: z.number().int().min(1).max(100).optional() });

/** Close/reopen, extend the expiry from now, or raise the cap. Closing is immediate for the next request. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = schema.parse(await req.json());
  const r = await one<VideoRequest>(
    `update video_requests set
        closed_at = case when $3::boolean is null then closed_at when $3 then coalesce(closed_at, now()) else null end,
        expires_at = case when $4::numeric is null then expires_at else now() + ($4 || ' days')::interval end,
        max_submissions = coalesce($5, max_submissions)
      where id=$1 and owner_id=$2 returning *`,
    [(await params).id, s.userId, b.closed ?? null, b.extendDays ?? null, b.maxSubmissions ?? null],
  );
  if (!r) throw new HttpError(404, "Request not found");
  return NextResponse.json({ ok: true });
});
