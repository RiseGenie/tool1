import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { uploadStatus } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ id: string }> };

/** Resume point: which chunks the server already has. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  return NextResponse.json(await uploadStatus((await params).id, { ownerId: s.userId }));
});
