"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageSquareWarning } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { fmtTime } from "./StatusBadge";

type Dec = { id: string; decision: "approved" | "changes_requested"; reviewerName: string; verified: boolean; note: string | null; createdAt: string };
type Hist = { id: string; versionNo: number; label: string | null; status: string; decisions: Dec[] };
type Review = { currentVersion: { versionNo: number; label: string | null }; status: string; decisions: Dec[]; history: Hist[] };

const LABEL: Record<string, string> = { pending: "Awaiting review", approved: "Approved", changes_requested: "Changes requested" };

/** Approve / request changes. The decision applies to the version shown on this page — and only that version. */
export function GuestReview({ token, signedIn, currentMs, onDone, version }: { token: string; signedIn: boolean; currentMs: () => number; onDone: () => void; version: number }) {
  const [r, setR] = useState<Review | null>(null);
  const [mode, setMode] = useState<null | "approved" | "changes_requested">(null);
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("rg_guest_name") || ""; } catch { return ""; }
  });
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [atTime, setAtTime] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setR(await jfetch<Review>(`/api/share/${token}/review`).catch(() => null)), [token]);
  useEffect(() => { void load(); }, [load, version]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    setBusy(true);
    setErr(null);
    try {
      if (!signedIn) try { localStorage.setItem("rg_guest_name", name); } catch {}
      await jfetch(`/api/share/${token}/review`, { method: "POST", json: { decision: mode, name: signedIn ? undefined : name, email: signedIn ? undefined : email, note, atMs: mode === "changes_requested" && atTime ? Math.round(currentMs()) : undefined } });
      setMode(null);
      setNote("");
      await load();
      onDone();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!r) return null;
  return (
    <section aria-label="Review" className="rg-card mb-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Review — version {r.currentVersion.versionNo}{r.currentVersion.label ? ` (${r.currentVersion.label})` : ""}</h2>
        <span role="status" className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${r.status === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : r.status === "changes_requested" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-800"}`}>{LABEL[r.status]}</span>
      </div>
      {!mode ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="rg-btn rg-btn-primary" onClick={() => setMode("approved")}><CheckCircle2 className="size-4" aria-hidden />Approve this version</button>
          <button className="rg-btn" onClick={() => setMode("changes_requested")}><MessageSquareWarning className="size-4" aria-hidden />Request changes</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <p className="text-sm font-semibold">{mode === "approved" ? "Approve version " + r.currentVersion.versionNo : "Request changes to version " + r.currentVersion.versionNo}</p>
          {!signedIn && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label htmlFor="rv-name" className="text-sm font-semibold">Your name</label><input id="rv-name" required className="rg-input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></div>
              <div><label htmlFor="rv-email" className="text-sm font-semibold">Email <span className="font-normal text-[color:var(--rg-muted)]">(optional)</span></label><input id="rv-email" type="email" className="rg-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
          )}
          <label htmlFor="rv-note" className="text-sm font-semibold">{mode === "approved" ? "Note (optional)" : "What should change?"}</label>
          <textarea id="rv-note" className="rg-input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} required={mode === "changes_requested"} maxLength={2000} />
          {mode === "changes_requested" && (
            <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={atTime} onChange={(e) => setAtTime(e.target.checked)} />Attach to the current video time ({fmtTime(currentMs())})</label>
          )}
          <p className="text-xs text-[color:var(--rg-muted)]">{signedIn ? "Recorded under your signed-in account." : "Names and emails you type aren’t verified; the sender sees them marked as a guest."}</p>
          <p role="alert" className="text-sm text-[color:var(--rg-bad)]">{err}</p>
          <div className="flex gap-2"><button className="rg-btn rg-btn-primary" disabled={busy}>Submit</button><button type="button" className="rg-btn" onClick={() => setMode(null)}>Cancel</button></div>
        </form>
      )}
      {r.history.some((h) => h.decisions.length) && (
        <details className="mt-3" open>
          <summary className="cursor-pointer text-sm font-semibold">Review history</summary>
          <ol className="mt-2 space-y-2 text-sm">
            {r.history.filter((h) => h.decisions.length).flatMap((h) => h.decisions.map((d) => (
              <li key={d.id} className="rounded-lg bg-slate-50 p-2">
                <span className="font-semibold">v{h.versionNo}</span> · {d.decision === "approved" ? "Approved" : "Changes requested"} by {d.reviewerName} <span className="text-xs text-[color:var(--rg-muted)]">({d.verified ? "verified" : "guest"})</span> · <time dateTime={d.createdAt} className="text-xs text-[color:var(--rg-muted)]">{new Date(d.createdAt).toLocaleString()}</time>
                {d.note && <p className="mt-0.5">{d.note}</p>}
              </li>
            )))}
          </ol>
        </details>
      )}
    </section>
  );
}
