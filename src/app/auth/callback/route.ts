import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/auth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/app";
  const sb = await supabaseServer();
  if (!sb || !code) return NextResponse.redirect(new URL("/login", url.origin));
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  return NextResponse.redirect(new URL(safe, url.origin));
}
