import { z } from "zod";
import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { getOwnedSop, sopView, stepsOf } from "@/lib/server/sops";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ title: z.string().trim().min(1).max(200).optional(), reviewed: z.boolean().optional() });

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const sop = await getOwnedSop((await params).id, s.userId);
  return NextResponse.json({ sop: await sopView(sop, await getOwned(sop.recording_id, s.userId)) });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = schema.parse(await req.json());
  const sop = await getOwnedSop((await params).id, s.userId);
  if (b.title !== undefined) await query(`update sops set title=$2, reviewed_at=null, updated_at=now() where id=$1`, [sop.id, b.title]);
  if (b.reviewed !== undefined) {
    if (b.reviewed) {
      if (sop.status !== "draft") throw new HttpError(409, "The draft isn’t ready yet");
      if (!(await stepsOf(sop.id)).length) throw new HttpError(409, "Add at least one step before marking this reviewed");
    }
    await query(`update sops set reviewed_at = case when $2 then now() else null end, updated_at=now() where id=$1`, [sop.id, b.reviewed]);
  }
  return NextResponse.json({ sop: await sopView(await getOwnedSop(sop.id, s.userId), await getOwned(sop.recording_id, s.userId)) });
});
