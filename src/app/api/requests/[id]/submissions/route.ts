import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const id = (await params).id;
  const own = await query(`select 1 from video_requests where id=$1 and owner_id=$2`, [id, s.userId]);
  if (!own.length) throw new HttpError(404, "Request not found");
  const rows = await query(
    `select id, title, status, submitter_name, submitter_email, submission_kind, created_at, duration_ms from recordings where request_id=$1 and (status <> 'uploading' or created_at > now() - interval '1 hour') order by created_at desc`,
    [id],
  );
  return NextResponse.json({
    submissions: rows.map((r) => ({ id: r.id, title: r.title, status: r.status, name: r.submitter_name, email: r.submitter_email, kind: r.submission_kind, createdAt: r.created_at, durationMs: r.duration_ms })),
  });
});
