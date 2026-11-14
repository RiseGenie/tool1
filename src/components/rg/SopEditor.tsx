"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Plus, RefreshCw, Trash2 } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { fmtTime } from "./StatusBadge";

type Step = { id: string; idx: number; title: string; body: string; atMs: number; edited: boolean; screenshotUrl: string | null };
type Sop = { id: string; title: string; status: "generating" | "draft" | "failed"; error: string | null; generator: string | null; reviewed: boolean; stale: boolean; versionNo: number; durationMs: number | null; steps: Step[] };

const parseTime = (t: string) => {
  const m = /^(\d+):([0-5]?\d)$/.exec(t.trim());
  return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
};

export function SopEditor({ recordingId }: { recordingId: string }) {
  const [sop, setSop] = useState<Sop | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setSop((await jfetch<{ sop: Sop | null }>(`/api/recordings/${recordingId}/sop`)).sop); } catch { setErr("Couldn’t load the SOP."); }
  }, [recordingId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (sop?.status !== "generating" && !sop?.steps.some((s) => s.edited && !s.screenshotUrl)) return;
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [sop, load]);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setErr(null);
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e) { setErr((e as Error).message); }
  }

  if (sop === undefined) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" />;
  const back = <Link href={`/app/v/${recordingId}`} className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[color:var(--rg-muted)] hover:text-[color:var(--rg-ink)]"><ArrowLeft className="size-4" aria-hidden />Back to video</Link>;

  if (sop === null)
    return (
      <div>{back}
        <div className="rg-card mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-bold">Turn this video into an SOP</h1>
          <p className="mt-2 text-sm text-[color:var(--rg-muted)]">We draft numbered steps from the video’s transcript, with a screenshot and a link back to each moment. You review and edit before exporting. Redactions on this version are respected.</p>
          <button className="rg-btn rg-btn-primary mt-5" onClick={() => void act(() => jfetch(`/api/recordings/${recordingId}/sop`, { method: "POST" }))}>Generate SOP draft</button>
          <p role="alert" className="mt-3 text-sm text-[color:var(--rg-bad)]">{err}</p>
        </div>
      </div>
    );

  return (
    <div>{back}
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="sr-only">Standard operating procedure: {sop.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="min-w-0 flex-1"><span className="sr-only">SOP title</span>
            <input className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold hover:border-[color:var(--rg-line)] focus:border-[color:var(--brand)] focus:bg-white" defaultValue={sop.title} key={sop.title} maxLength={200}
              onBlur={(e) => e.target.value.trim() && e.target.value !== sop.title && void act(() => jfetch(`/api/sops/${sop.id}`, { method: "PATCH", json: { title: e.target.value.trim() } }))} />
          </label>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${sop.reviewed ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{sop.reviewed ? "Reviewed" : "Draft — not reviewed"}</span>
        </div>
        <p className="px-2 text-sm text-[color:var(--rg-muted)]">
          From video version {sop.versionNo} · {sop.generator === "transcript-outline" ? "Outline built from the transcript (no AI)" : sop.generator === "even-intervals" ? "Placeholder steps (no transcript)" : sop.generator ? `Drafted by ${sop.generator}` : ""}
        </p>
        {sop.status === "generating" && <p role="status" className="rg-card p-4 text-sm">Generating your draft… this page updates automatically.</p>}
        {sop.status === "failed" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-[color:var(--rg-bad)]">Generation failed: {sop.error} <button className="underline" onClick={() => void act(() => jfetch(`/api/recordings/${recordingId}/sop`, { method: "POST" }))}>Try again</button></p>}
        {sop.status === "draft" && sop.error && <p role="note" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{sop.error}</p>}
        {sop.stale && <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The video was re-rendered after this draft was made. Regenerate or check each screenshot.</p>}

        <ol className="space-y-4">
          {sop.steps.map((s, i) => (
            <li key={s.id} className="rg-card p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-full sm:w-56">
                  {s.screenshotUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={s.screenshotUrl} alt={`Screenshot for step ${i + 1}`} className="aspect-video w-full rounded-lg bg-slate-900 object-cover" /> : <div className="grid aspect-video place-items-center rounded-lg bg-slate-200 text-xs text-[color:var(--rg-muted)]">Screenshot pending…</div>}
                  <Link href={`/app/v/${recordingId}?t=${s.atMs}`} className="mt-1 inline-block text-xs font-semibold text-[color:var(--brand)]">▶ Watch at {fmtTime(s.atMs)}</Link>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[color:var(--brand)] text-sm font-bold text-white" aria-hidden>{i + 1}</span>
                    <label className="flex-1"><span className="sr-only">Step {i + 1} title</span>
                      <input className="rg-input font-semibold" defaultValue={s.title} key={s.id + s.title} maxLength={200} onBlur={(e) => e.target.value.trim() && e.target.value !== s.title && void act(() => jfetch(`/api/sops/${sop.id}/steps/${s.id}`, { method: "PATCH", json: { title: e.target.value.trim() } }))} />
                    </label>
                  </div>
                  <label className="block"><span className="sr-only">Step {i + 1} instructions</span>
                    <textarea className="rg-input min-h-20" defaultValue={s.body} key={s.id + s.body} maxLength={4000} placeholder="Describe what to do in this step" onBlur={(e) => e.target.value !== s.body && void act(() => jfetch(`/api/sops/${sop.id}/steps/${s.id}`, { method: "PATCH", json: { body: e.target.value } }))} />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-sm">Video time
                      <input className="rg-input !min-h-9 !w-20 font-mono" defaultValue={fmtTime(s.atMs)} key={s.id + s.atMs} aria-label={`Step ${i + 1} video time (m:ss)`}
                        onBlur={(e) => { const ms = parseTime(e.target.value); if (ms === null) { e.target.value = fmtTime(s.atMs); setErr("Use m:ss, for example 1:05"); } else if (ms !== s.atMs) void act(() => jfetch(`/api/sops/${sop.id}/steps/${s.id}`, { method: "PATCH", json: { atMs: ms } })); }} />
                    </label>
                    <button className="rg-btn !min-h-9" disabled={i === 0} aria-label={`Move step ${i + 1} up`} onClick={() => void act(() => jfetch(`/api/sops/${sop.id}/steps/${s.id}`, { method: "PATCH", json: { move: "up" } }))}><ArrowUp className="size-4" aria-hidden /></button>
                    <button className="rg-btn !min-h-9" disabled={i === sop.steps.length - 1} aria-label={`Move step ${i + 1} down`} onClick={() => void act(() => jfetch(`/api/sops/${sop.id}/steps/${s.id}`, { method: "PATCH", json: { move: "down" } }))}><ArrowDown className="size-4" aria-hidden /></button>
                    <button className="rg-btn rg-btn-danger !min-h-9" aria-label={`Delete step ${i + 1}`} onClick={() => void act(() => jfetch(`/api/sops/${sop.id}/steps/${s.id}`, { method: "DELETE" }))}><Trash2 className="size-4" aria-hidden /></button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {sop.status === "draft" && (
          <div className="rg-card space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <button className="rg-btn" onClick={() => { const t = prompt("Video time for the new step (m:ss)", "0:00"); const ms = t ? parseTime(t) : null; if (ms !== null) void act(() => jfetch(`/api/sops/${sop.id}/steps`, { method: "POST", json: { title: "New step", body: "", atMs: ms } })); }}><Plus className="size-4" aria-hidden />Add step</button>
              <button className="rg-btn" onClick={() => { if (!sop.steps.some((s) => s.edited) || confirm("Regenerating replaces every step, including your edits. Continue?")) void act(() => jfetch(`/api/recordings/${recordingId}/sop`, { method: "POST" })); }}><RefreshCw className="size-4" aria-hidden />Regenerate</button>
              <button className={`rg-btn ${sop.reviewed ? "" : "rg-btn-primary"}`} onClick={() => void act(() => jfetch(`/api/sops/${sop.id}`, { method: "PATCH", json: { reviewed: !sop.reviewed } }), sop.reviewed ? "Review cleared." : "Marked as reviewed. You can export now.")}>{sop.reviewed ? "Unmark reviewed" : "I’ve reviewed this SOP"}</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a className={`rg-btn ${sop.reviewed ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!sop.reviewed} href={`/api/sops/${sop.id}/export?format=md`}><Download className="size-4" aria-hidden />Export Markdown</a>
              <a className={`rg-btn ${sop.reviewed ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!sop.reviewed} href={`/api/sops/${sop.id}/export?format=html`}><Download className="size-4" aria-hidden />Export for Google Docs</a>
            </div>
            <p className="text-xs text-[color:var(--rg-muted)]">Export unlocks after you mark the SOP reviewed; editing anything clears that. “Google Docs” downloads a Docs-ready HTML file: upload it to Google Drive and choose Open with → Google Docs. Direct export into your Google account isn’t connected yet.</p>
          </div>
        )}
        <p role="status" aria-live="polite" className="text-sm text-[color:var(--rg-ok)]">{msg}</p>
        <p role="alert" className="text-sm text-[color:var(--rg-bad)]">{err}</p>
      </div>
    </div>
  );
}
