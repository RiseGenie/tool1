import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { attachmentsOf, buildPayload, configuredTracker, getOwnedBug } from "@/lib/server/bugs";

type Ctx = { params: Promise<{ id: string }> };

/** The exact payload that Submit would send. A recording link is shown as a placeholder: it is only created at submit time, and only if opted in. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const b = await getOwnedBug((await params).id, s.userId);
  const p = buildPayload(b, await attachmentsOf(b.id), b.include_link && b.recording_id ? "(a viewing link will be created when you submit)" : null);
  return NextResponse.json({ payload: p, destination: configuredTracker()?.name ?? null });
});
