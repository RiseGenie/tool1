import { NextResponse } from "next/server";
import { one } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { MAX_REQUEST_BYTES, resolveRequest } from "@/lib/server/requests";

type Ctx = { params: Promise<{ token: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const r = await resolveRequest((await params).token);
  const [{ n }] = [await one<{ n: number }>(`select count(*)::int as n from recordings where request_id=$1 and (status <> 'uploading' or created_at > now() - interval '1 hour')`, [r.id])] as [{ n: number }];
  return NextResponse.json({
    title: r.title, instructions: r.instructions, expiresAt: r.expires_at, remaining: Math.max(0, r.max_submissions - n),
    allowScreen: r.allow_screen, allowCamera: r.allow_camera, allowUpload: r.allow_upload, maxBytes: MAX_REQUEST_BYTES,
  });
});
