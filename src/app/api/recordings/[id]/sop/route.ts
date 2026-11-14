import { NextResponse } from "next/server";
import { one } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { enqueue } from "@/lib/server/jobs";
import { sopView, type Sop } from "@/lib/server/sops";
import { query } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const sop = await one<Sop>(`select * from sops where recording_id=$1`, [rec.id]);
  return NextResponse.json({ sop: sop ? await sopView(sop, rec) : null });
});

/** Generate (or regenerate) the SOP draft for this version. Regeneration replaces every step and clears the author's sign-off. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  if (rec.status !== "ready" || !rec.playback_key) throw new HttpError(409, "The video must finish processing first");
  const sop = (await query<Sop>(
    `insert into sops(recording_id, owner_id, title) values ($1,$2,$3)
     on conflict (recording_id) do update set status='generating', error=null, generation = sops.generation + 1, reviewed_at=null, updated_at=now()
     returning *`,
    [rec.id, s.userId, rec.title],
  ))[0];
  await enqueue("sop", rec.id, { payload: { sopId: sop.id }, dedupeKey: `sop:${sop.id}:${sop.generation}` });
  return NextResponse.json({ sop: await sopView(sop, rec) }, { status: 202 });
});
