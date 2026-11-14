"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Paperclip, Plus, Trash2 } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { fmtBytes } from "./StatusBadge";

const LABELS: Record<string, string> = { userAgent: "Browser", platform: "Operating system", language: "Language", timezone: "Time zone", viewport: "Window size", screen: "Screen size", pixelRatio: "Pixel ratio", online: "Online", cores: "CPU cores", memoryGb: "Device memory (GB)", connection: "Connection type", appBuild: "App version" };
const DEFAULT_ON = new Set(["userAgent", "platform", "viewport", "screen", "online", "appBuild"]);

type Report = { id: string; recordingId: string | null; title: string; steps: string; expected: string; actual: string; severity: string; diagnostics: Record<string, string>; includeLink: boolean; status: string; trackerRef: string | null; trackerError: string | null; attachments: { id: string; filename: string; mimeType: string; sizeBytes: number }[]; trackerConfigured: boolean };
type Rec = { id: string; title: string; status: string };

function collect(): Record<string, string> {
  const n = navigator as Navigator & { userAgentData?: { platform?: string }; deviceMemory?: number; connection?: { effectiveType?: string } };
  const d: Record<string, string> = {
    userAgent: n.userAgent, platform: n.userAgentData?.platform || n.platform || "unknown", language: n.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: `${innerWidth}×${innerHeight}`, screen: `${screen.width}×${screen.height}`, pixelRatio: String(devicePixelRatio), online: String(n.onLine), cores: String(n.hardwareConcurrency ?? ""),
    appBuild: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
  };
  if (n.deviceMemory) d.memoryGb = String(n.deviceMemory);
  if (n.connection?.effectiveType) d.connection = n.connection.effectiveType;
  return d;
}

export function BugList() {
  const router = useRouter();
  const [rows, setRows] = useState<{ id: string; title: string; status: string; severity: string; trackerRef: string | null; createdAt: string }[] | null>(null);
  useEffect(() => { jfetch<{ reports: typeof rows }>("/api/bug-reports").then((r) => setRows(r.reports)).catch(() => setRows([])); }, []);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">Bug reports</h1><button className="rg-btn rg-btn-primary ml-auto" onClick={async () => { const r = await jfetch<{ id: string }>("/api/bug-reports", { method: "POST", json: {} }); router.push(`/app/bug/${r.id}`); }}><Plus className="size-4" aria-hidden />New bug report</button></div>
      {rows === null ? <div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" /> : rows.length === 0 ? <p className="rg-card mt-4 p-6 text-sm text-[color:var(--rg-muted)]">No reports yet. Attach a recording, steps to reproduce, and review exactly what’s sent before it goes to your tracker.</p> : (
        <ul className="mt-4 space-y-2">{rows.map((r) => <li key={r.id} className="rg-card flex flex-wrap items-center gap-3 p-3"><Link className="font-semibold text-[color:var(--brand)] hover:underline" href={`/app/bug/${r.id}`}>{r.title}</Link><span className="text-xs text-[color:var(--rg-muted)]">{r.severity} · {new Date(r.createdAt).toLocaleDateString()}</span><span className="ml-auto text-xs font-semibold capitalize">{r.status}</span></li>)}</ul>
      )}
    </div>
  );
}

export function BugEditor({ id }: { id: string }) {
  const router = useRouter();
  const [r, setR] = useState<Report | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [diag, setDiag] = useState<Record<string, string>>({});
  const [on, setOn] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<{ payload: { title: string; body: string }; destination: string | null } | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One debounce timer PER FIELD: a shared timer would drop the previous field's edit when the user tabs on quickly.
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => { setR((await jfetch<{ report: Report }>(`/api/bug-reports/${id}`)).report); }, [id]);
  useEffect(() => {
    void load().catch(() => setErr("Couldn’t load this report."));
    jfetch<{ items: Rec[] }>("/api/recordings").then((x) => setRecs(x.items.filter((i) => i.status === "ready"))).catch(() => {});
    const c = collect();
    setDiag(c);
    const attach = new URLSearchParams(location.search).get("attach");
    if (attach) void jfetch(`/api/bug-reports/${id}`, { method: "PATCH", json: { recordingId: attach } }).then(load);
  }, [id, load]);
  useEffect(() => {
    // Mirror the report's stored selection once; afterwards the checkboxes are the source of truth.
    if (r && Object.keys(on).length === 0) setOn(Object.fromEntries(Object.keys(diag).map((k) => [k, r.diagnostics[k] !== undefined || (Object.keys(r.diagnostics).length === 0 && DEFAULT_ON.has(k))])));
  }, [r, diag, on]);

  // Saves are chained so they reach the server in the order the user made them (concurrent PATCHes could otherwise be applied out of order).
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const patch = useCallback((body: object) => {
    const run = async () => { try { setR((await jfetch<{ report: Report }>(`/api/bug-reports/${id}`, { method: "PATCH", json: body })).report); setPreview(null); setReviewed(false); } catch (e) { setErr((e as Error).message); } };
    chain.current = chain.current.then(run, run);
    return chain.current as Promise<void>;
  }, [id]);
  const saveText = (body: Record<string, unknown>, flush = false) => {
    const k = Object.keys(body)[0];
    clearTimeout(timers.current[k]);
    if (flush) void patch(body);
    else timers.current[k] = setTimeout(() => void patch(body), 600);
  };
  const sendDiag = (next: Record<string, boolean>) => void patch({ diagnostics: Object.fromEntries(Object.entries(next).filter(([, v]) => v).map(([k]) => [k, diag[k]])) });

  if (!r) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" aria-busy="true">{err}</div>;
  const locked = r.status === "submitted" || r.status === "submitting";

  async function upload(f: File) {
    setErr(null);
    const form = new FormData();
    form.set("file", f);
    const res = await fetch(`/api/bug-reports/${id}/attachments`, { method: "POST", body: form });
    if (!res.ok) setErr((await res.json().catch(() => ({}))).error || "Upload failed");
    await load();
    setPreview(null);
  }
  async function showPreview() { setErr(null); setPreview(await jfetch(`/api/bug-reports/${id}/preview`)); setReviewed(false); }
  async function submit() {
    setBusy(true); setErr(null);
    try { await jfetch(`/api/bug-reports/${id}/submit`, { method: "POST", json: { confirmed: true } }); await load(); setMsg("Submitted."); } catch (e) { setErr((e as Error).message); await load(); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/app/bug" className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[color:var(--rg-muted)]"><ArrowLeft className="size-4" aria-hidden />All reports</Link>
      <h1 className="text-2xl font-bold">Bug report</h1>
      {locked && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Submitted{r.trackerRef ? <> — <span className="font-mono">{r.trackerRef}</span></> : null}. This report is now read-only.</p>}
      {r.status === "failed" && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-[color:var(--rg-bad)]">Last attempt failed: {r.trackerError}. Nothing was filed twice; you can retry.</p>}

      <fieldset disabled={locked} className="rg-card space-y-3 p-4">
        <div><label htmlFor="b-title" className="text-sm font-semibold">Title</label><input id="b-title" className="rg-input mt-1" defaultValue={r.title} maxLength={200} onChange={(e) => saveText({ title: e.target.value })} onBlur={(e) => saveText({ title: e.target.value }, true)} /></div>
        <div><label htmlFor="b-sev" className="text-sm font-semibold">Severity</label><select id="b-sev" className="rg-input mt-1" value={r.severity} onChange={(e) => void patch({ severity: e.target.value })}>{["low", "normal", "high", "blocker"].map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label htmlFor="b-steps" className="text-sm font-semibold">Steps to reproduce</label><textarea id="b-steps" className="rg-input mt-1 min-h-28" defaultValue={r.steps} maxLength={8000} onChange={(e) => saveText({ steps: e.target.value })} onBlur={(e) => saveText({ steps: e.target.value }, true)} placeholder={"1. Go to …\n2. Click …"} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="b-exp" className="text-sm font-semibold">Expected behavior</label><textarea id="b-exp" className="rg-input mt-1 min-h-20" defaultValue={r.expected} maxLength={2000} onChange={(e) => saveText({ expected: e.target.value })} onBlur={(e) => saveText({ expected: e.target.value }, true)} /></div>
          <div><label htmlFor="b-act" className="text-sm font-semibold">Actual behavior</label><textarea id="b-act" className="rg-input mt-1 min-h-20" defaultValue={r.actual} maxLength={2000} onChange={(e) => saveText({ actual: e.target.value })} onBlur={(e) => saveText({ actual: e.target.value }, true)} /></div>
        </div>
      </fieldset>

      <fieldset disabled={locked} className="rg-card space-y-3 p-4">
        <legend className="sr-only">Recording</legend>
        <h2 className="font-semibold">Recording</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="b-rec">Attach a recording</label>
          <select id="b-rec" className="rg-input !w-auto min-w-64" value={r.recordingId ?? ""} onChange={(e) => void patch({ recordingId: e.target.value || null })}><option value="">No recording</option>{recs.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
          <Link className="rg-btn" href={`/app/record?bug=${id}`}>Record a new one</Link>
          {r.recordingId && <Link className="text-sm font-semibold text-[color:var(--brand)] hover:underline" href={`/app/v/${r.recordingId}`}>Open recording</Link>}
        </div>
        {r.recordingId && (
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={r.includeLink} onChange={(e) => void patch({ includeLink: e.target.checked })} /><span><span className="font-semibold">Include a viewing link in the report.</span> This creates an anyone-with-the-link, view-only link (no download). Off by default: otherwise the report mentions no link.</span></label>
        )}
      </fieldset>

      <fieldset disabled={locked} className="rg-card space-y-3 p-4">
        <legend className="sr-only">Supporting files</legend>
        <h2 className="flex items-center gap-2 font-semibold"><Paperclip className="size-4" aria-hidden />Supporting files</h2>
        <p className="text-xs text-[color:var(--rg-muted)]">Up to 5 files, 10 MB each: images, PDFs or plain-text logs. Content is checked, not just the file name.</p>
        <ul className="space-y-1">{r.attachments.map((a) => <li key={a.id} className="flex items-center gap-2 text-sm"><span className="font-medium">{a.filename}</span><span className="text-xs text-[color:var(--rg-muted)]">{fmtBytes(a.sizeBytes)}</span><button className="rg-btn rg-btn-danger !min-h-8 ml-auto" aria-label={`Remove ${a.filename}`} onClick={async () => { await jfetch(`/api/bug-reports/${id}/attachments/${a.id}`, { method: "DELETE" }); await load(); setPreview(null); }}><Trash2 className="size-4" aria-hidden /></button></li>)}</ul>
        <label className="rg-btn cursor-pointer"><Plus className="size-4" aria-hidden />Add file<input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label>
      </fieldset>

      <fieldset disabled={locked} className="rg-card space-y-3 p-4">
        <legend className="sr-only">Diagnostics</legend>
        <h2 className="font-semibold">Diagnostics to include</h2>
        <p className="text-xs text-[color:var(--rg-muted)]">Only the items you tick are saved and sent. Nothing else is collected: no cookies, page contents, URLs or account details.</p>
        <ul className="space-y-1">
          {Object.keys(diag).map((k) => (
            <li key={k}><label className="flex min-h-9 items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={!!on[k]} onChange={(e) => { const next = { ...on, [k]: e.target.checked }; setOn(next); sendDiag(next); }} /><span><span className="font-semibold">{LABELS[k] ?? k}:</span> <span className="break-all font-mono text-xs">{diag[k]}</span></span></label></li>
          ))}
        </ul>
      </fieldset>

      <section className="rg-card space-y-3 p-4" aria-label="Review and submit">
        <h2 className="font-semibold">Review &amp; submit</h2>
        <button className="rg-btn" onClick={() => void showPreview()}>Preview exactly what will be sent</button>
        {preview && (
          <div>
            <p className="text-sm">Destination: <strong>{preview.destination ?? "none configured"}</strong></p>
            <h3 className="mt-2 font-semibold">{preview.payload.title || "(no title yet)"}</h3>
            <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs" tabIndex={0} aria-label="Report preview">{preview.payload.body}</pre>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button className="rg-btn" onClick={() => void navigator.clipboard.writeText(`# ${preview.payload.title}\n\n${preview.payload.body}`).then(() => setMsg("Copied as Markdown."))}>Copy as Markdown</button>
              {!locked && preview.destination && (
                <>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />I’ve reviewed this and want to send it to {preview.destination}</label>
                  <button className="rg-btn rg-btn-primary" disabled={!reviewed || busy || !preview.payload.title} onClick={() => void submit()}>Submit report</button>
                </>
              )}
            </div>
            {!preview.destination && <p className="mt-2 text-xs text-[color:var(--rg-muted)]">No bug tracker is connected for this workspace. Copy the report as Markdown and paste it into your tracker.</p>}
          </div>
        )}
        <p role="status" aria-live="polite" className="text-sm text-[color:var(--rg-ok)]">{msg}</p>
        <p role="alert" className="text-sm text-[color:var(--rg-bad)]">{err}</p>
      </section>
      <button className="rg-btn rg-btn-danger" onClick={async () => { if (confirm("Delete this report and its attachments?")) { await jfetch(`/api/bug-reports/${id}`, { method: "DELETE" }); router.push("/app/bug"); } }}><Trash2 className="size-4" aria-hidden />Delete report</button>
    </div>
  );
}
