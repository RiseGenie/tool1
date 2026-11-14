import { z } from "zod";
import { NextResponse } from "next/server";
import { query } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(await req.json());
  const r = await query(`update folders set name=$3 where id=$1 and owner_id=$2 returning id`, [(await params).id, s.userId, name]);
  if (!r.length) throw new HttpError(404, "Folder not found");
  return NextResponse.json({ ok: true });
});

/** Deleting a folder never deletes recordings; they move back to "No folder". */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession();
  const r = await query(`delete from folders where id=$1 and owner_id=$2 returning id`, [(await params).id, s.userId]);
  if (!r.length) throw new HttpError(404, "Folder not found");
  return NextResponse.json({ ok: true });
});
