import { z } from "zod";
import { NextResponse } from "next/server";
import { handle, clientIp } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";
import { getOwned } from "@/lib/server/recordings";
import { addComment, listComments } from "@/lib/server/comments";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ atMs: z.number().min(0), body: z.string().trim().min(1).max(4000), parentId: z.string().uuid().nullable().optional() });

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  return NextResponse.json({ comments: await listComments(rec) });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const rec = await getOwned((await params).id, s.userId);
  const b = schema.parse(await req.json());
  const id = await addComment(rec, b, { session: s, viewerId: s.userId, ip: clientIp(req) });
  return NextResponse.json({ id }, { status: 201 });
});
