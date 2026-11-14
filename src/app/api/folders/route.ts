import { z } from "zod";
import { NextResponse } from "next/server";
import { one, query } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { requireSession } from "@/lib/server/auth";

export const GET = handle(async () => {
  const s = await requireSession();
  const rows = await query(`select id, name from folders where owner_id=$1 order by name`, [s.userId]);
  return NextResponse.json({ folders: rows });
});

export const POST = handle(async (req: Request) => {
  const s = await requireSession();
  const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(await req.json());
  const row = await one(`insert into folders(owner_id, name) values ($1,$2) returning id, name`, [s.userId, name]);
  return NextResponse.json({ folder: row }, { status: 201 });
});
