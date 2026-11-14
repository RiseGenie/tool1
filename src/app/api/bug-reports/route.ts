import { z } from "zod";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import type { Bug } from "@/lib/server/bugs";

export const GET = handle(async () => {
  const s = await requireSession();
  const rows = await query<Bug>(`select * from bug_reports where owner_id=$1 order by created_at desc limit 100`, [s.userId]);
  return NextResponse.json({ reports: rows.map((b) => ({ id: b.id, title: b.title || "Untitled report", status: b.status, severity: b.severity, trackerRef: b.tracker_ref, createdAt: b.created_at })) });
});

export const POST = handle(async (req: Request) => {
  const s = await requireSession();
  const { recordingId } = z.object({ recordingId: z.string().uuid().nullable().optional() }).parse(await req.json().catch(() => ({})));
  if (recordingId && !(await one(`select 1 as x from recordings where id=$1 and owner_id=$2 and deleted_at is null`, [recordingId, s.userId]))) throw new HttpError(404, "Recording not found");
  const r = await one<Bug>(`insert into bug_reports(owner_id, recording_id) values ($1,$2) returning *`, [s.userId, recordingId ?? null]);
  return NextResponse.json({ id: r!.id }, { status: 201 });
});
