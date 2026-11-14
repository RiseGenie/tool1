"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Monitor, Square, Upload } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { RecorderEngine } from "@/lib/recorder/engine";
import { detectCapabilities } from "@/lib/recorder/capabilities";
import { openLocalStore, type LocalStore } from "@/lib/recorder/local-store";
import { Uploader, requestEndpoints, type UploadState } from "@/lib/recorder/uploader";
import { fmtBytes, fmtTime } from "./StatusBadge";

type Meta = { title: string; instructions: string; expiresAt: string; remaining: number; allowScreen: boolean; allowCamera: boolean; allowUpload: boolean; maxBytes: number };
type Phase = "form" | "recording" | "uploading" | "done";
const EXT: Record<string, string> = { webm: "video/webm", mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska" };

/** Account-free response page for a video request: record a screen, record a video reply, or upload a file. */
export function RequestResponder({ token }: { token: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [gone, setGone] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [err, setErr] = useState<string | null>(null);
  const [up, setUp] = useState<UploadState | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const engine = useRef<RecorderEngine | null>(null);
  const store = useRef<LocalStore | null>(null);
  const uploader = useRef<Uploader | null>(null);
  const idRef = useRef("");
  const slices = useRef<Promise<void>>(Promise.resolve());
  const [caps, setCaps] = useState<ReturnType<typeof detectCapabilities> | null>(null);

  useEffect(() => {
    setCaps(detectCapabilities());
    jfetch<Meta>(`/api/r/${token}`).then(setMeta).catch((e) => setGone((e as { status?: number }).status === 410 ? (e as Error).message : "This request link isn’t valid."));
  }, [token]);
  useEffect(() => () => { engine.current?.release(); uploader.current?.dispose(); }, []);
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed(engine.current?.elapsedMs ?? 0), 250);
    return () => clearInterval(t);
  }, [phase]);

  async function begin(kind: "screen" | "camera" | "upload", mime: string, size?: number) {
    idRef.current = crypto.randomUUID();
    store.current ??= await openLocalStore();
    await store.current.createSession({ id: idRef.current, mime, title: meta?.title ?? "Response", createdAt: Date.now() });
    uploader.current = new Uploader(idRef.current, store.current, setUp, 3, requestEndpoints(token, { kind, name, email: email || undefined, declaredSize: size }));
    await uploader.current.init({ mimeType: mime });
  }

  async function record(kind: "screen" | "camera") {
    if (!name.trim()) return setErr("Please enter your name first.");
    setErr(null);
    setBusy(true);
    try {
      const e = await RecorderEngine.create({
        mode: kind === "screen" ? "screen" : "cam", micDeviceId: "", camDeviceId: null, captureAudio: true, height: 720,
        overlay: { visible: false, x: 0.1, y: 0.8, size: 0.2 },
        onSlice: (blob, seq) => { const id = idRef.current; slices.current = slices.current.then(async () => { await store.current?.addSlice(id, seq, blob).catch(() => {}); uploader.current?.notifySlice(seq, blob.size); }); },
        onCaptureEnded: () => void stop(),
        onNotice: () => {},
      });
      engine.current = e;
      try { await begin(kind, e.mimeType || "video/webm"); } catch (x) { e.release(); engine.current = null; throw x; }
      e.start();
      setPhase("recording");
    } catch (x) {
      setErr((x as DOMException).name === "NotAllowedError" ? "Permission was denied. Choose what to share when your browser asks." : (x as Error).message);
    } finally { setBusy(false); }
  }

  async function stop() {
    const e = engine.current;
    if (!e || e.status === "stopped") return;
    setPhase("uploading");
    await e.stop();
    e.release();
    engine.current = null;
    await slices.current;
    try { await uploader.current!.finish(); setPhase("done"); } catch (x) { setErr((x as Error).message); }
  }

  async function sendFile(f: File) {
    if (!name.trim()) return setErr("Please enter your name first.");
    setErr(null);
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = EXT[ext];
    if (!mime) return setErr("Please choose a WebM, MP4 or MOV video.");
    if (meta && f.size > meta.maxBytes) return setErr(`That file is ${fmtBytes(f.size)}. The limit is ${fmtBytes(meta.maxBytes)}.`);
    setBusy(true);
    try {
      await begin("upload", mime, f.size);
      setPhase("uploading");
      const CH = 1024 * 1024;
      for (let i = 0, off = 0; off < f.size; i++, off += CH) await store.current!.addSlice(idRef.current, i, f.slice(off, off + CH));
      await uploader.current!.resume();
      setPhase("done");
    } catch (x) {
      setErr((x as Error).message);
      setPhase("form");
    } finally { setBusy(false); }
  }

  if (gone) return <div role="alert" className="rg-card p-8 text-center"><h1 className="text-xl font-bold">This request isn’t available</h1><p className="mt-2 text-sm text-[color:var(--rg-muted)]">{gone} Ask the sender for a new link.</p></div>;
  if (!meta) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" />;
  if (phase === "done") return <div role="status" className="rg-card p-8 text-center"><CheckCircle2 className="mx-auto size-10 text-[color:var(--rg-ok)]" aria-hidden /><h1 className="mt-3 text-xl font-bold">Thanks — your video was sent</h1><p className="mt-1 text-sm text-[color:var(--rg-muted)]">You can close this page.</p></div>;
  if (phase === "recording") return (
    <div className="rg-card p-8 text-center">
      <p role="status" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white"><span aria-hidden className="size-2.5 animate-pulse rounded-full bg-white" />REC</p>
      <p className="mt-3 font-mono text-4xl font-semibold tabular-nums" aria-label={`Elapsed ${fmtTime(elapsed)}`}>{fmtTime(elapsed)}</p>
      <button className="rg-btn rg-btn-primary mt-5" onClick={() => void stop()}><Square className="size-4 fill-current" aria-hidden />Stop &amp; send</button>
      <p className="mt-4 text-sm text-[color:var(--rg-muted)]">You can also use your browser’s Stop sharing button.</p>
    </div>
  );
  if (phase === "uploading") {
    const pct = up?.totalBytes ? Math.min(100, Math.round((up.uploadedBytes / up.totalBytes) * 100)) : null;
    return (
      <div className="rg-card p-8" role="region" aria-label="Upload progress">
        <h1 className="text-xl font-bold">Sending your video…</h1>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label="Upload progress"><div className="h-full rounded-full" style={{ width: `${pct ?? 10}%`, background: "var(--brand)" }} /></div>
        <p className="mt-2 text-sm tabular-nums" aria-live="polite">{pct !== null ? `${pct}%` : "Preparing…"} {up?.status === "stalled" ? "— connection interrupted, retrying" : ""}</p>
        {err && <p role="alert" className="mt-3 text-sm text-[color:var(--rg-bad)]">{err}</p>}
      </div>
    );
  }
  const canRecord = !!caps?.canRecordScreen;
  return (
    <div className="rg-card p-6">
      <h1 className="text-2xl font-bold">{meta.title}</h1>
      {meta.instructions && <p className="mt-2 whitespace-pre-wrap text-[color:var(--rg-muted)]">{meta.instructions}</p>}
      <p className="mt-2 text-xs text-[color:var(--rg-muted)]">Link expires {new Date(meta.expiresAt).toLocaleString()}.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="rq-name" className="text-sm font-semibold">Your name</label><input id="rq-name" className="rg-input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required /></div>
        <div><label htmlFor="rq-email" className="text-sm font-semibold">Email <span className="font-normal text-[color:var(--rg-muted)]">(optional)</span></label><input id="rq-email" type="email" className="rg-input mt-1" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {meta.allowScreen && <button className="rg-btn rg-btn-primary" disabled={busy || !canRecord} onClick={() => void record("screen")}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Monitor className="size-4" aria-hidden />}Record my screen</button>}
        {meta.allowCamera && <button className="rg-btn" disabled={busy || !caps?.canRecordCamera} onClick={() => void record("camera")}><Camera className="size-4" aria-hidden />Record a video reply</button>}
        {meta.allowUpload && (
          <label className={`rg-btn cursor-pointer ${busy ? "opacity-50" : ""}`}>
            <Upload className="size-4" aria-hidden />Upload a video file
            <input type="file" accept="video/webm,video/mp4,video/quicktime,video/x-matroska,.webm,.mp4,.mov,.mkv" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendFile(f); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {meta.allowScreen && caps && !canRecord && <p className="mt-3 text-sm text-[color:var(--rg-muted)]">Screen recording isn’t available in this browser. You can still upload a file{meta.allowCamera ? " or record a video reply" : ""}.</p>}
      <p role="alert" className="mt-3 text-sm text-[color:var(--rg-bad)]">{err}</p>
      <p className="mt-4 text-xs text-[color:var(--rg-muted)]">Max file size {fmtBytes(meta.maxBytes)}. WebM, MP4 or MOV. Your response goes only to the person who sent this request.</p>
    </div>
  );
}
