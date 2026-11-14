import { NextResponse } from "next/server";
import { DEV_COOKIE, supabaseServer } from "@/lib/server/auth";

export async function POST(req: Request) {
  const sb = await supabaseServer();
  await sb?.auth.signOut();
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(DEV_COOKIE);
  return res;
}
