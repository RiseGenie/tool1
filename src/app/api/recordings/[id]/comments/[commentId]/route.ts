import { z } from "zod";
import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, commentId } = await params;
  const rec = await getOwned(id, s.userId); // only the recording's owner moderates
  const r = await query(`update comments set deleted_at=now() where id=$1 and recording_id=$2 and deleted_at is null returning id`, [commentId, rec.id]);
  if (!r.length) throw new HttpError(404, "Comment not found");
  return NextResponse.json({ ok: true });
});

/** Mark a change request resolved (or reopen it). */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, commentId } = await params;
  const { resolved } = z.object({ resolved: z.boolean() }).parse(await req.json());
  const rec = await getOwned(id, s.userId);
  const r = await query(`update comments set resolved_at = case when $3 then now() else null end where id=$1 and recording_id=$2 and deleted_at is null returning id`, [commentId, rec.id, resolved]);
  if (!r.length) throw new HttpError(404, "Comment not found");
  return NextResponse.json({ ok: true });
});
