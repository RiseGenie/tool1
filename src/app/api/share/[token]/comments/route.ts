import { z } from "zod";
import { NextResponse } from "next/server";
import { handle, HttpError, clientIp } from "@/lib/server/http";
import { getSession } from "@/lib/server/auth";
import { resolveShare, viewerId } from "@/lib/server/recordings";
import { addComment, listComments } from "@/lib/server/comments";

type Ctx = { params: Promise<{ token: string }> };
const schema = z.object({
  atMs: z.number().min(0),
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().uuid().nullable().optional(),
  guestName: z.string().trim().max(60).optional(),
});

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { link, rec } = await resolveShare((await params).token);
  return NextResponse.json({ allowed: link.allow_comments, comments: await listComments(rec) });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { link, rec } = await resolveShare((await params).token);
  if (!link.allow_comments) throw new HttpError(403, "Comments are turned off for this link");
  const b = schema.parse(await req.json());
  const session = await getSession().catch(() => null);
  const id = await addComment(rec, b, { session, viewerId: session?.userId ?? (await viewerId()), ip: clientIp(req) });
  return NextResponse.json({ id }, { status: 201 });
});
