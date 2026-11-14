"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export function LoginForm({ supabase, dev }: { supabase: boolean; dev: boolean }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (supabase) {
        const sb = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        setMsg({ kind: "ok", text: "Check your email for a sign-in link." });
      } else if (dev) {
        const r = await fetch("/api/dev-login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name }) });
        if (!r.ok) throw new Error((await r.json()).error || "Sign-in failed");
        const next = new URLSearchParams(location.search).get("next");
        location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
      } else {
        throw new Error("Authentication is not configured.");
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="text-sm font-semibold">Work email</label>
        <input id="email" type="email" required autoComplete="email" className="rg-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {!supabase && dev && (
        <div>
          <label htmlFor="name" className="text-sm font-semibold">Name <span className="font-normal text-[color:var(--rg-muted)]">(optional)</span></label>
          <input id="name" className="rg-input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      )}
      <button className="rg-btn rg-btn-primary w-full" disabled={busy}>{supabase ? "Email me a sign-in link" : "Sign in (development)"}</button>
      {!supabase && dev && (
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          Development sign-in: no password or verification. Set the Supabase variables to use real authentication. This mode is disabled automatically in production builds.
        </p>
      )}
      <p role="status" aria-live="polite" className={`text-sm ${msg?.kind === "err" ? "text-[color:var(--rg-bad)]" : "text-[color:var(--rg-ok)]"}`}>{msg?.text}</p>
    </form>
  );
}
