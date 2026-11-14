import { NextResponse } from "next/server";
import { handle } from "@/lib/server/http";
import { resolveRequest } from "@/lib/server/requests";
import { uploadStatus } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ token: string; id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { token, id } = await params;
  const r = await resolveRequest(token, { upload: true });
  return NextResponse.json(await uploadStatus(id, { ownerId: r.owner_id, requestId: r.id }));
});
