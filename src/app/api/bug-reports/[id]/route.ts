import { z } from "zod";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { attachmentsOf, bugView, cleanDiagnostics, getOwnedBug } from "@/lib/server/bugs";
import { getStorage } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  title: z.string().trim().max(200).optional(), steps: z.string().max(8000).optional(), expected: z.string().max(2000).optional(), actual: z.string().max(2000).optional(),
  severity: z.enum(["low", "normal", "high", "blocker"]).optional(), recordingId: z.string().uuid().nullable().optional(), includeLink: z.boolean().optional(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
});

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = await getOwnedBug((await params).id, s.userId);
  return NextResponse.json({ report: bugView(b, await attachmentsOf(b.id)) });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = await getOwnedBug((await params).id, s.userId);
  if (b.status === "submitted" || b.status === "submitting") throw new HttpError(409, "This report was already submitted");
  const d = schema.parse(await req.json());
  if (d.recordingId && !(await one(`select 1 as x from recordings where id=$1 and owner_id=$2 and deleted_at is null`, [d.recordingId, s.userId]))) throw new HttpError(404, "Recording not found");
  await query(
    `update bug_reports set title=coalesce($2,title), steps=coalesce($3,steps), expected=coalesce($4,expected), actual=coalesce($5,actual), severity=coalesce($6,severity),
            recording_id = case when $7::boolean then $8 else recording_id end, include_link = coalesce($9, include_link),
            diagnostics = case when $10::boolean then $11::jsonb else diagnostics end, updated_at=now() where id=$1`,
    [b.id, d.title ?? null, d.steps ?? null, d.expected ?? null, d.actual ?? null, d.severity ?? null, d.recordingId !== undefined, d.recordingId ?? null, d.includeLink ?? null,
     d.diagnostics !== undefined, JSON.stringify(cleanDiagnostics(d.diagnostics))],
  );
  const nb = await getOwnedBug(b.id, s.userId);
  return NextResponse.json({ report: bugView(nb, await attachmentsOf(b.id)) });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = await getOwnedBug((await params).id, s.userId);
  const atts = await attachmentsOf(b.id);
  await query(`delete from bug_reports where id=$1`, [b.id]);
  await Promise.allSettled(atts.map((a) => getStorage().remove(a.storage_key)));
  return NextResponse.json({ ok: true });
});
