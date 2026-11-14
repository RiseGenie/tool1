import { z } from "zod";
import { NextResponse } from "next/server";
import { tx } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { enqueue } from "@/lib/server/jobs";
import { getOwnedSop } from "@/lib/server/sops";

type Ctx = { params: Promise<{ id: string; stepId: string }> };
const schema = z.object({ title: z.string().trim().min(1).max(200).optional(), body: z.string().max(4000).optional(), atMs: z.number().int().min(0).optional(), move: z.enum(["up", "down"]).optional() });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, stepId } = await params;
  const b = schema.parse(await req.json());
  const sop = await getOwnedSop(id, s.userId);
  const rec = await getOwned(sop.recording_id, s.userId);
  if (b.atMs !== undefined && b.atMs > (rec.duration_ms ?? 0)) throw new HttpError(400, "That time is past the end of the video");
  await tx(async (c) => {
    const st = (await c.query(`select * from sop_steps where id=$1 and sop_id=$2 for update`, [stepId, sop.id])).rows[0];
    if (!st) throw new HttpError(404, "Step not found");
    if (b.title !== undefined || b.body !== undefined || b.atMs !== undefined)
      await c.query(`update sop_steps set title=coalesce($2,title), body=coalesce($3,body), at_ms=coalesce($4,at_ms), edited=true where id=$1`, [stepId, b.title ?? null, b.body ?? null, b.atMs ?? null]);
    if (b.atMs !== undefined && b.atMs !== st.at_ms) await enqueue("sop", rec.id, { payload: { stepId }, dedupeKey: `sopframe:${stepId}:${b.atMs}`, client: c });
    if (b.move) {
      const other = (await c.query(`select id, idx from sop_steps where sop_id=$1 and idx ${b.move === "up" ? "<" : ">"} $2 order by idx ${b.move === "up" ? "desc" : "asc"} limit 1`, [sop.id, st.idx])).rows[0];
      if (other) {
        await c.query(`update sop_steps set idx = -1 where id=$1`, [stepId]);
        await c.query(`update sop_steps set idx=$2 where id=$1`, [other.id, st.idx]);
        await c.query(`update sop_steps set idx=$2 where id=$1`, [stepId, other.idx]);
      }
    }
    await c.query(`update sops set reviewed_at=null, updated_at=now() where id=$1`, [sop.id]);
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { id, stepId } = await params;
  const sop = await getOwnedSop(id, s.userId);
  await tx(async (c) => {
    const r = await c.query(`delete from sop_steps where id=$1 and sop_id=$2 returning idx`, [stepId, sop.id]);
    if (!r.rowCount) throw new HttpError(404, "Step not found");
    await c.query(`update sop_steps set idx = idx - 1 where sop_id=$1 and idx > $2`, [sop.id, r.rows[0].idx]);
    await c.query(`update sops set reviewed_at=null, updated_at=now() where id=$1`, [sop.id]);
  });
  return NextResponse.json({ ok: true });
});
