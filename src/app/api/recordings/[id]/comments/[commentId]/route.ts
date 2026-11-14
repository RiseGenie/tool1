import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";

type Ctx = { params: Promise<{ id: string; commentId: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, commentId } = await params;
  const rec = await getOwned(id, s.userId); // only the recording's owner moderates in Phase 1
  const r = await query(`update comments set deleted_at=now() where id=$1 and recording_id=$2 and deleted_at is null returning id`, [commentId, rec.id]);
  if (!r.length) throw new HttpError(404, "Comment not found");
  return NextResponse.json({ ok: true });
});
