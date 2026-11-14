import { z } from "zod";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { enqueue } from "@/lib/server/jobs";
import { getOwnedSop } from "@/lib/server/sops";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ title: z.string().trim().min(1).max(200), body: z.string().max(4000).default(""), atMs: z.number().int().min(0) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = schema.parse(await req.json());
  const sop = await getOwnedSop((await params).id, s.userId);
  const rec = await getOwned(sop.recording_id, s.userId);
  if (b.atMs > (rec.duration_ms ?? 0)) throw new HttpError(400, "That time is past the end of the video");
  const row = await tx(async (c) => {
    const n = (await c.query(`select coalesce(max(idx),-1)+1 as n from sop_steps where sop_id=$1`, [sop.id])).rows[0].n;
    const r = (await c.query(`insert into sop_steps(sop_id, idx, title, body, at_ms, edited) values ($1,$2,$3,$4,$5,true) returning id`, [sop.id, n, b.title, b.body, b.atMs])).rows[0];
    await c.query(`update sops set reviewed_at=null, updated_at=now() where id=$1`, [sop.id]);
    await enqueue("sop", rec.id, { payload: { stepId: r.id }, dedupeKey: `sopframe:${r.id}:${b.atMs}`, client: c });
    return r;
  });
  return NextResponse.json({ id: row.id }, { status: 201 });
});
