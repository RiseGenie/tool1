import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { reviewHistory } from "@/lib/server/review";

type Ctx = { params: Promise<{ id: string }> };

/** Owner view: every version (drafts included) with its decisions and open change requests. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const history = await reviewHistory(rec.series_id, { includeDrafts: true });
  const open = await query<{ recording_id: string; n: number }>(
    `select recording_id, count(*)::int as n from comments where kind='change_request' and resolved_at is null and deleted_at is null
      and recording_id = any($1) group by recording_id`,
    [history.map((h) => h.id)],
  );
  return NextResponse.json({ versions: history.map((h) => ({ ...h, openChangeRequests: open.find((o) => o.recording_id === h.id)?.n ?? 0 })) });
});
