import { z } from "zod";
import { NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { DEV_COOKIE, encodeDevSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const POST = handle(async (req: Request) => {
  if (!env.devAuth) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { email, name } = z.object({ email: z.string().email(), name: z.string().max(80).optional() }).parse(await req.json());
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_COOKIE, encodeDevSession(email, name), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
  return res;
});
