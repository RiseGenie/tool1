import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwnedBug } from "@/lib/server/bugs";
import { getStorage } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string; attId: string }> };

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, attId } = await params;
  const b = await getOwnedBug(id, s.userId);
  if (b.status === "submitted") throw new HttpError(409, "This report was already submitted");
  const r = await query<{ storage_key: string }>(`delete from bug_attachments where id=$1 and report_id=$2 returning storage_key`, [attId, b.id]);
  if (!r.length) throw new HttpError(404, "Attachment not found");
  await getStorage().remove(r[0].storage_key).catch(() => {});
  return NextResponse.json({ ok: true });
});
