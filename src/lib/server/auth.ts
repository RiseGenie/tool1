import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "./env";
import { one } from "./db";
import { HttpError, unauthorized } from "./http";
import { sign, uuidFrom, verifySig } from "./tokens";

export type Session = { userId: string; email: string; name: string | null };

export const DEV_COOKIE = "rg_dev";

export function encodeDevSession(email: string, name?: string): string {
  const body = Buffer.from(JSON.stringify({ email: email.toLowerCase(), name: name || null })).toString("base64url");
  return `${body}.${sign(`dev:${body}`)}`;
}

async function devSession(): Promise<Session | null> {
  if (!env.devAuth) return null;
  const raw = (await cookies()).get(DEV_COOKIE)?.value;
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig || !verifySig(`dev:${body}`, sig)) return null;
  try {
    const { email, name } = JSON.parse(Buffer.from(body, "base64url").toString());
    return { userId: uuidFrom(`dev:${email}`), email, name };
  } catch {
    return null;
  }
}

export async function supabaseServer() {
  const cfg = env.supabase;
  if (!cfg) return null;
  const store = await cookies();
  return createServerClient(cfg.url, cfg.anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a Server Component; middleware/route handlers refresh the session */
        }
      },
    },
  });
}

async function supabaseSession(): Promise<Session | null> {
  const sb = await supabaseServer();
  if (!sb) return null;
  const { data } = await sb.auth.getUser(); // validates the JWT with Supabase, not just the cookie
  const u = data.user;
  if (!u?.email) return null;
  return { userId: u.id, email: u.email.toLowerCase(), name: (u.user_metadata?.full_name as string) || null };
}

export async function getSession(): Promise<Session | null> {
  if (!env.supabase && !env.devAuth) {
    throw new HttpError(503, "Authentication is not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  }
  const s = (await supabaseSession()) ?? (await devSession());
  if (!s) return null;
  await one(
    `insert into users(id, email, name) values ($1,$2,$3)
     on conflict (id) do update set email = excluded.email, name = coalesce(excluded.name, users.name)`,
    [s.userId, s.email, s.name],
  );
  return s;
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw unauthorized();
  return s;
}
