"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { StatusBadge } from "./StatusBadge";

type Req = { id: string; title: string; instructions: string; expiresAt: string; maxSubmissions: number; submissions: number; status: "active" | "expired" | "closed" | "full"; url: string | null; allowScreen: boolean; allowCamera: boolean; allowUpload: boolean };
type Sub = { id: string; title: string; status: string; name: string | null; email: string | null; kind: string; createdAt: string };

export function RequestsPage() {
  const [reqs, setReqs] = useState<Req[] | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [subs, setSubs] = useState<Record<string, Sub[]>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", instructions: "", expiresInDays: 7, maxSubmissions: 10, allowScreen: true, allowCamera: true, allowUpload: true, folderId: "" });

  const load = useCallback(async () => { setReqs((await jfetch<{ requests: Req[] }>("/api/requests")).requests); }, []);
  useEffect(() => { void load(); jfetch<{ folders: { id: string; name: string }[] }>("/api/folders").then((r) => setFolders(r.folders)).catch(() => {}); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try { await jfetch("/api/requests", { method: "POST", json: { ...f, folderId: f.folderId || null } }); setF({ ...f, title: "", instructions: "" }); await load(); } catch (x) { setErr((x as Error).message); }
  }
  async function toggle(id: string) {
    setOpen(open === id ? null : id);
    if (open !== id) setSubs((s) => ({ ...s }));
    const r = await jfetch<{ submissions: Sub[] }>(`/api/requests/${id}/submissions`);
    setSubs((s) => ({ ...s, [id]: r.submissions }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <form onSubmit={create} className="rg-card h-fit space-y-3 p-4">
        <h1 className="text-xl font-bold">Request a video</h1>
        <p className="text-sm text-[color:var(--rg-muted)]">Send a link. People respond without an account; responses land in your library.</p>
        <div><label htmlFor="r-title" className="text-sm font-semibold">What do you need?</label><input id="r-title" required className="rg-input mt-1" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={200} placeholder="Show us the bug you’re seeing" /></div>
        <div><label htmlFor="r-ins" className="text-sm font-semibold">Instructions</label><textarea id="r-ins" className="rg-input mt-1 min-h-20" value={f.instructions} onChange={(e) => setF({ ...f, instructions: e.target.value })} maxLength={2000} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label htmlFor="r-exp" className="text-sm font-semibold">Expires after</label><select id="r-exp" className="rg-input mt-1" value={f.expiresInDays} onChange={(e) => setF({ ...f, expiresInDays: Number(e.target.value) })}>{[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}</select></div>
          <div><label htmlFor="r-max" className="text-sm font-semibold">Max responses</label><input id="r-max" type="number" min={1} max={100} className="rg-input mt-1" value={f.maxSubmissions} onChange={(e) => setF({ ...f, maxSubmissions: Number(e.target.value) })} /></div>
        </div>
        <fieldset><legend className="text-sm font-semibold">Ways to respond</legend>
          {([["allowScreen", "Record their screen"], ["allowCamera", "Record a video reply"], ["allowUpload", "Upload a file"]] as const).map(([k, l]) => (
            <label key={k} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />{l}</label>
          ))}
        </fieldset>
        <div><label htmlFor="r-folder" className="text-sm font-semibold">Save responses to</label><select id="r-folder" className="rg-input mt-1" value={f.folderId} onChange={(e) => setF({ ...f, folderId: e.target.value })}><option value="">No folder</option>{folders.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        <p role="alert" className="text-sm text-[color:var(--rg-bad)]">{err}</p>
        <button className="rg-btn rg-btn-primary w-full">Create request link</button>
      </form>

      <section aria-label="Your requests">
        <h2 className="text-xl font-bold">Your requests</h2>
        {reqs === null ? <div className="mt-4 h-32 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" /> : reqs.length === 0 ? <p className="mt-3 text-sm text-[color:var(--rg-muted)]">No requests yet.</p> : (
          <ul className="mt-4 space-y-3">
            {reqs.map((r) => (
              <li key={r.id} className="rg-card p-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{r.title}</h3>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${r.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}>{r.status === "full" ? "Full" : r.status[0].toUpperCase() + r.status.slice(1)}</span>
                  <span className="text-xs text-[color:var(--rg-muted)]">{r.submissions}/{r.maxSubmissions} responses · expires {new Date(r.expiresAt).toLocaleString()}</span></div>
                {r.url && (
                  <div className="mt-2 flex gap-2"><label className="sr-only" htmlFor={`ru-${r.id}`}>Request link</label><input id={`ru-${r.id}`} readOnly className="rg-input font-mono !text-xs" value={r.url} onFocus={(e) => e.currentTarget.select()} />
                    <button className="rg-btn" onClick={async () => { await navigator.clipboard.writeText(r.url!); setCopied(r.id); setTimeout(() => setCopied(null), 1800); }}>{copied === r.id ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied === r.id ? "Copied" : "Copy"}</button></div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="rg-btn !min-h-9" onClick={() => void toggle(r.id)} aria-expanded={open === r.id}>Responses ({r.submissions})</button>
                  <button className="rg-btn !min-h-9" onClick={async () => { await jfetch(`/api/requests/${r.id}`, { method: "PATCH", json: { extendDays: 7 } }); await load(); }}>Extend 7 days</button>
                  <button className="rg-btn rg-btn-danger !min-h-9" onClick={async () => { await jfetch(`/api/requests/${r.id}`, { method: "PATCH", json: { closed: r.status !== "closed" } }); await load(); }}>{r.status === "closed" ? "Reopen" : "Close link"}</button>
                </div>
                {open === r.id && (
                  <ul className="mt-3 space-y-1 border-t border-[color:var(--rg-line)] pt-3 text-sm">
                    {(subs[r.id] ?? []).length === 0 && <li className="text-[color:var(--rg-muted)]">No responses yet.</li>}
                    {(subs[r.id] ?? []).map((s) => <li key={s.id} className="flex flex-wrap items-center gap-2"><Link className="font-semibold text-[color:var(--brand)] hover:underline" href={`/app/v/${s.id}`}>{s.name}</Link><span className="text-xs text-[color:var(--rg-muted)]">{s.kind} · {new Date(s.createdAt).toLocaleString()}{s.email ? ` · ${s.email} (unverified)` : ""}</span><StatusBadge status={s.status} /></li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
