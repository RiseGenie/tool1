"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Download, Loader2, Mic, MicOff, Monitor, Pause, Play, RotateCcw, Square, Trash2, Video, VideoOff } from "lucide-react";
import { detectCapabilities, type Capabilities } from "@/lib/recorder/capabilities";
import { OVERLAY_CORNERS, RecorderEngine, type Notice, type Overlay, type RecordMode } from "@/lib/recorder/engine";
import { openLocalStore, type LocalSession, type LocalStore } from "@/lib/recorder/local-store";
import { Uploader, deleteServerRecording, type UploadState } from "@/lib/recorder/uploader";
import { fmtBytes, fmtTime } from "./StatusBadge";

type Phase = "setup" | "starting" | "countdown" | "recording" | "uploading" | "failed";
type Dev = { id: string; label: string };

const MODES: { id: RecordMode; title: string; hint: string; icon: React.ReactNode }[] = [
  { id: "screen-cam", title: "Screen + camera", hint: "Your screen with a face bubble", icon: <Monitor className="size-5" aria-hidden /> },
  { id: "screen", title: "Screen only", hint: "A tab, window or whole screen", icon: <Monitor className="size-5" aria-hidden /> },
  { id: "cam", title: "Camera only", hint: "Talk straight to the lens", icon: <Camera className="size-5" aria-hidden /> },
];
const SIZES = { s: 0.2, m: 0.28, l: 0.38 } as const;

const STATES = ["Recording", "Uploading", "Processing", "Ready"];

export function RecorderApp() {
  const router = useRouter();
  // Detected after mount: capabilities differ between server and browser, so they must not affect the first render.
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => setCaps(detectCapabilities()), []);

  const [mode, setMode] = useState<RecordMode>("screen-cam");
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [storeKind, setStoreKind] = useState<"idb" | "memory" | null>(null);

  const [cams, setCams] = useState<Dev[]>([]);
  const [mics, setMics] = useState<Dev[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [micId, setMicId] = useState<string>(""); // "" = default, "none" = no mic
  const [captureAudio, setCaptureAudio] = useState(true);
  const [height, setHeight] = useState<720 | 1080>(1080);
  const [overlay, setOverlay] = useState<Overlay>({ visible: true, ...OVERLAY_CORNERS["bottom-left"], size: SIZES.m });
  const [level, setLevel] = useState(0);
  const [camOk, setCamOk] = useState<boolean | null>(null);

  const engine = useRef<RecorderEngine | null>(null);
  const store = useRef<LocalStore | null>(null);
  const uploader = useRef<Uploader | null>(null);
  const sessionId = useRef<string>("");
  const phaseRef = useRef<Phase>("setup");
  const camStream = useRef<MediaStream | null>(null);
  const micStream = useRef<MediaStream | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const persistFailed = useRef(false);
  const slicePromise = useRef<Promise<void>>(Promise.resolve());
  phaseRef.current = phase;

  const needCam = mode !== "screen";
  const needMic = micId !== "none";
  const pushNotice = useCallback((n: Notice) => setNotices((x) => [...x.filter((y) => y.code !== n.code), n]), []);

  // ---------- local store + recovery ----------
  const refreshSessions = useCallback(async () => {
    const s = store.current ? await store.current.listSessions() : [];
    setSessions(s.filter((x) => x.id !== sessionId.current && x.slices > 0));
  }, []);
  useEffect(() => {
    let live = true;
    openLocalStore().then(async (s) => {
      if (!live) return;
      store.current = s;
      setStoreKind(s.kind);
      await refreshSessions();
    });
    return () => {
      live = false;
    };
  }, [refreshSessions]);

  // ---------- devices + previews ----------
  const refreshDevices = useCallback(async () => {
    const all = await navigator.mediaDevices.enumerateDevices();
    const mk = (kind: MediaDeviceKind, fb: string) => all.filter((d) => d.kind === kind && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `${fb} ${i + 1}` }));
    setCams(mk("videoinput", "Camera"));
    setMics(mk("audioinput", "Microphone"));
  }, []);

  useEffect(() => {
    if (!caps?.canRecordCamera) return;
    refreshDevices().catch(() => {});
    navigator.mediaDevices.addEventListener("devicechange", () => void refreshDevices());
    return () => navigator.mediaDevices.removeEventListener("devicechange", () => void refreshDevices());
  }, [caps, refreshDevices]);

  // If the selected device was unplugged, fall back to the default and say so.
  useEffect(() => {
    if (camId && cams.length && !cams.some((c) => c.id === camId)) {
      setCamId("");
      pushNotice({ level: "warn", code: "cam-gone", message: "The selected camera was disconnected. Switched to the default camera." });
    }
    if (micId && micId !== "none" && mics.length && !mics.some((m) => m.id === micId)) {
      setMicId("");
      pushNotice({ level: "warn", code: "mic-gone", message: "The selected microphone was disconnected. Switched to the default microphone." });
    }
  }, [cams, mics, camId, micId, pushNotice]);

  const stopPreviews = useCallback(() => {
    camStream.current?.getTracks().forEach((t) => t.stop());
    micStream.current?.getTracks().forEach((t) => t.stop());
    camStream.current = micStream.current = null;
  }, []);

  useEffect(() => {
    if (phase !== "setup" || !caps?.canRecordCamera || !needCam) {
      if (phase === "setup") {
        camStream.current?.getTracks().forEach((t) => t.stop());
        camStream.current = null;
         
        setCamOk(null);
      }
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { deviceId: camId ? { exact: camId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        camStream.current?.getTracks().forEach((t) => t.stop());
        camStream.current = s;
        setCamOk(true);
        if (previewVideo.current) previewVideo.current.srcObject = s;
        void refreshDevices();
      })
      .catch((e: DOMException) => {
        if (cancelled) return;
        setCamOk(false);
        setError(
          e.name === "NotAllowedError" ? "Camera access was blocked. Allow it in your browser’s site settings, or choose “Screen only”."
          : e.name === "NotFoundError" ? "No camera was found. Plug one in, or choose “Screen only”."
          : e.name === "NotReadableError" ? "The camera is in use by another app. Close it and try again."
          : "Couldn’t start the camera.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [needCam, camId, phase, caps, refreshDevices]);

  useEffect(() => {
    if (phase !== "setup" || !caps?.canRecordCamera || !needMic) {
      if (phase === "setup") {
        micStream.current?.getTracks().forEach((t) => t.stop());
        micStream.current = null;
         
        setLevel(0);
      }
      return;
    }
    let cancelled = false;
    let ctx: AudioContext | null = null;
    let timer: number | undefined;
    navigator.mediaDevices
      .getUserMedia({ audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        micStream.current?.getTracks().forEach((t) => t.stop());
        micStream.current = s;
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(an);
        const buf = new Uint8Array(an.fftSize);
        timer = window.setInterval(() => {
          an.getByteTimeDomainData(buf);
          let p = 0;
          for (const v of buf) p = Math.max(p, Math.abs(v - 128) / 128);
          setLevel(Math.min(1, p * 1.6));
        }, 60);
        void refreshDevices();
      })
      .catch(() => {
        if (!cancelled) setError("Microphone access was blocked or no microphone was found. You can record without one.");
      });
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      void ctx?.close().catch(() => {});
    };
  }, [needMic, micId, phase, caps, refreshDevices]);

  // Release hardware when leaving the page.
  useEffect(
    () => () => {
      engine.current?.release();
      stopPreviews();
      uploader.current?.dispose();
    },
    [stopPreviews],
  );

  // Warn before closing the tab during recording/upload.
  useEffect(() => {
    if (phase === "setup" || phase === "failed") return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  // Timer + tab title.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => {
      const ms = engine.current?.elapsedMs ?? 0;
      setElapsed(ms);
      document.title = `${engine.current?.status === "paused" ? "⏸ Paused" : "● REC"} ${fmtTime(ms)}`;
    }, 250);
    return () => {
      window.clearInterval(id);
      document.title = "New recording";
    };
  }, [phase]);

  // Attach the live compositing canvas to the stage so the camera bubble can be dragged while recording.
  useEffect(() => {
    const c = engine.current?.previewCanvas;
    const host = stage.current;
    if (phase === "recording" && c && host) {
      c.className = "w-full rounded-lg bg-black touch-none cursor-move";
      c.setAttribute("aria-label", "Live preview. Drag to move the camera bubble.");
      host.replaceChildren(c);
    }
  }, [phase]);

  // ---------- recording flow ----------
  async function persistSlice(id: string, blob: Blob, seq: number) {
    try {
      if (!persistFailed.current) await store.current!.addSlice(id, seq, blob);
    } catch {
      if (!persistFailed.current) {
        persistFailed.current = true;
        pushNotice({ level: "warn", code: "persist-failed", message: "Couldn’t save a local backup (storage is full or blocked). Keep this tab open until the upload finishes." });
      }
    }
    uploader.current?.notifySlice(seq, blob.size);
  }

  async function newSession(mime: string) {
    const id = crypto.randomUUID();
    sessionId.current = id;
    persistFailed.current = false;
    const title = `Recording ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    await store.current?.createSession({ id, mime, title, createdAt: Date.now() });
    uploader.current?.dispose();
    const u = new Uploader(id, store.current!, setUpload);
    uploader.current = u;
    await u.init({ mimeType: mime, title });
  }

  async function begin() {
    setError(null);
    setNotices([]);
    setPhase("starting");
    try {
      if (!store.current) store.current = await openLocalStore();
      const e = await RecorderEngine.create({
        mode,
        micDeviceId: micId === "none" ? null : micId,
        camDeviceId: camId || null,
        captureAudio,
        overlay,
        height,
        micStream: micStream.current,
        camStream: camStream.current,
        onSlice: (blob, seq) => {
          const id = sessionId.current;
          slicePromise.current = slicePromise.current.then(() => persistSlice(id, blob, seq));
        },
        onCaptureEnded: () => {
          if (phaseRef.current === "recording") {
            pushNotice({ level: "info", code: "sharing-stopped", message: "Sharing stopped. Saving your recording…" });
            void stopAndSave();
          } else if (phaseRef.current === "countdown") cancel();
        },
        onNotice: pushNotice,
        onLevel: setLevel,
      });
      engine.current = e;
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__rg = { engine: e };
      try {
        await newSession(e.mimeType || "video/webm");
      } catch (err) {
        e.release();
        engine.current = null;
        throw err;
      }
      if (!e.hasSystemAudio && mode !== "cam" && captureAudio)
        pushNotice({ level: "info", code: "no-system-audio", message: "No tab or system audio was shared. If you want it, pick a tab (or, on Windows, the entire screen) and tick “Share audio”." });
      setPhase("countdown");
      for (let i = 3; i > 0; i--) {
        setCount(i);
        await new Promise((r) => setTimeout(r, 1000));
        if (phaseRef.current !== "countdown") return;
      }
      e.start();
      setElapsed(0);
      setPaused(false);
      setPhase("recording");
    } catch (err) {
      engine.current?.release();
      engine.current = null;
      const name = (err as DOMException)?.name;
      const status = (err as { status?: number })?.status;
      setError(
        status === 401 ? "Your session expired. Sign in again, then retry."
        : name === "NotAllowedError" ? "Permission was denied. Choose a screen, window or tab when your browser asks."
        : name === "NotFoundError" ? "A selected device wasn’t found."
        : name === "NotReadableError" ? "A device is busy in another app."
        : (err as Error)?.message || "Couldn’t start recording.",
      );
      setPhase("setup");
    }
  }

  function cancel() {
    engine.current?.release();
    engine.current = null;
    const id = sessionId.current;
    if (id) {
      void store.current?.deleteSession(id);
      void deleteServerRecording(id);
    }
    setPhase("setup");
  }

  async function stopAndSave() {
    const e = engine.current;
    if (!e || phaseRef.current !== "recording") return;
    setPhase("uploading");
    const id = sessionId.current;
    const { durationMs } = await e.stop();
    e.release(); // stops every screen/mic/camera track
    engine.current = null;
    stopPreviews();
    await slicePromise.current; // every slice is persisted before we finalize
    await store.current?.markStopped(id, durationMs).catch(() => {});
    try {
      await uploader.current!.finish();
      router.push(`/app/v/${id}`);
    } catch (err) {
      setError((err as Error).message || "Upload failed");
      setPhase("failed");
      await refreshSessions();
    }
  }

  async function restartTake() {
    const e = engine.current;
    if (!e) return;
    const old = sessionId.current;
    await slicePromise.current;
    void store.current?.deleteSession(old);
    void deleteServerRecording(old);
    try {
      await newSession(e.mimeType || "video/webm");
      e.restart();
      setElapsed(0);
      setPaused(false);
    } catch {
      setError("Couldn’t restart the recording.");
    }
  }

  function togglePause() {
    const e = engine.current;
    if (!e) return;
    if (e.status === "paused") e.resume();
    else e.pause();
    setPaused(e.status === "paused");
    setElapsed(e.elapsedMs); // reflect the exact value immediately instead of waiting for the next tick
  }

  function setOv(p: Partial<Overlay>) {
    setOverlay((o) => ({ ...o, ...p }));
    engine.current?.setOverlay(p);
  }

  function drag(e: React.PointerEvent<HTMLDivElement>) {
    if (engine.current == null || !(e.buttons & 1)) return;
    const r = (e.currentTarget.firstElementChild as HTMLElement | null)?.getBoundingClientRect();
    if (!r) return;
    setOv({ x: Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width)), y: Math.min(0.95, Math.max(0.05, (e.clientY - r.top) / r.height)) });
  }

  // ---------- recovery actions ----------
  async function recoverUpload(s: LocalSession) {
    setError(null);
    sessionId.current = s.id;
    setPhase("uploading");
    uploader.current?.dispose();
    const u = new Uploader(s.id, store.current!, setUpload);
    uploader.current = u;
    try {
      await u.init({ mimeType: s.mime, title: s.title });
      await u.resume();
      router.push(`/app/v/${s.id}`);
    } catch (err) {
      setError((err as Error).message || "Upload failed");
      setPhase("failed");
    }
  }

  async function downloadLocal(s: LocalSession) {
    const parts = await store.current!.readSlices(s.id, 0, Number.MAX_SAFE_INTEGER);
    const url = URL.createObjectURL(new Blob(parts, { type: s.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.title.replace(/[^\w\- ]+/g, "")}.${s.mime.includes("mp4") ? "mp4" : "webm"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function discardLocal(s: LocalSession) {
    if (!confirm("Discard this unsent recording? This can’t be undone.")) return;
    await store.current?.deleteSession(s.id);
    void deleteServerRecording(s.id);
    await refreshSessions();
  }

  // ---------- render ----------
  if (!caps) return null;

  if (phase === "countdown")
    return (
      <div role="dialog" aria-modal="true" aria-label="Recording starts soon" className="fixed inset-0 z-50 grid place-items-center bg-[#14142b]/90 text-white">
        <div className="text-center">
          <div key={count} className="text-9xl font-bold tabular-nums" aria-live="assertive">{count}</div>
          <p className="mt-3 text-white/80">Switch to what you’re sharing — recording starts now.</p>
          <button className="rg-btn mt-8 !bg-transparent !text-white" onClick={cancel}>Cancel</button>
        </div>
      </div>
    );

  if (phase === "recording")
    return (
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rg-card p-6" aria-label="Recording controls">
          <div className="flex items-center gap-3">
            <span role="status" className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">
              <span aria-hidden className={`size-2.5 rounded-full bg-white ${paused ? "" : "animate-pulse"}`} />
              {paused ? "PAUSED" : "REC"}
            </span>
            <span className="font-mono text-4xl font-semibold tabular-nums" aria-label={`Elapsed ${fmtTime(elapsed)}`}>{fmtTime(elapsed)}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={togglePause} className="rg-btn">{paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}{paused ? "Resume" : "Pause"}</button>
            <button onClick={() => void stopAndSave()} className="rg-btn rg-btn-primary"><Square className="size-4 fill-current" aria-hidden />Stop &amp; save</button>
            <button onClick={() => void restartTake()} className="rg-btn"><RotateCcw className="size-4" aria-hidden />Restart</button>
            <button onClick={() => { if (confirm("Discard this recording?")) cancel(); }} className="rg-btn rg-btn-danger"><Trash2 className="size-4" aria-hidden />Discard</button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {micId !== "none" && (
              <button
                onClick={() => { const m = !micMuted; setMicMuted(m); engine.current?.setMicMuted(m); }}
                aria-pressed={micMuted}
                className="rg-btn"
              >
                {micMuted ? <MicOff className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
                {micMuted ? "Mic muted" : "Mic on"}
              </button>
            )}
            {mode === "screen-cam" && (
              <button onClick={() => setOv({ visible: !overlay.visible })} aria-pressed={!overlay.visible} className="rg-btn">
                {overlay.visible ? <Video className="size-4" aria-hidden /> : <VideoOff className="size-4" aria-hidden />}
                {overlay.visible ? "Hide camera" : "Show camera"}
              </button>
            )}
          </div>
          {mode === "screen-cam" && (
            <fieldset className="mt-5">
              <legend className="text-sm font-semibold">Camera position</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(OVERLAY_CORNERS) as (keyof typeof OVERLAY_CORNERS)[]).map((k) => (
                  <button key={k} onClick={() => setOv({ ...OVERLAY_CORNERS[k], visible: true })} className="rg-btn !min-h-9 capitalize">{k.replace("-", " ")}</button>
                ))}
              </div>
            </fieldset>
          )}
          <Notices notices={notices} />
          <p className="mt-6 text-sm text-[color:var(--rg-muted)]">
            You can switch to the window you’re sharing. Use your browser’s <strong>Stop sharing</strong> button, or come back here, to finish. Your recording is saved to this device as it goes.
          </p>
        </section>
        <aside className="rg-card p-4">
          <h2 className="text-sm font-semibold">Live preview</h2>
          {mode === "screen-cam" ? (
            <div ref={stage} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); }} onPointerMove={drag} className="mt-2" />
          ) : (
            <p className="mt-2 text-sm text-[color:var(--rg-muted)]">The preview is shown for screen + camera, where you can drag the camera bubble.</p>
          )}
        </aside>
      </div>
    );

  if (phase === "uploading" || phase === "failed")
    return (
      <div className="mx-auto max-w-xl">
        <UploadPanel state={upload} failed={phase === "failed"} error={error} onRetry={() => (phase === "failed" ? void recoverUpload(sessions.find((s) => s.id === sessionId.current) ?? ({ id: sessionId.current, mime: "video/webm", title: "Recording" } as LocalSession)) : uploader.current?.retryNow())} onBack={() => { setPhase("setup"); setError(null); void refreshSessions(); }} />
      </div>
    );

  const usable = mode === "cam" ? caps.canRecordCamera : caps.canRecordScreen && (mode === "screen" || caps.canRecordCamera);
  const busy = phase === "starting";
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rg-card p-6">
        <h1 className="text-2xl font-bold">New recording</h1>
        <p className="mt-1 text-sm text-[color:var(--rg-muted)]">Pick what to capture, check your camera and microphone, then start.</p>

        {sessions.length > 0 && (
          <div role="region" aria-label="Unsent recordings" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <h2 className="font-semibold text-amber-900">Recover unsent recordings</h2>
            <p className="text-sm text-amber-900/80">These were saved on this device but never finished uploading.</p>
            <ul className="mt-3 space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-sm">
                  <span className="mr-auto font-medium">{s.title} <span className="font-normal text-[color:var(--rg-muted)]">· {fmtBytes(s.bytes)}{s.durationMs ? ` · ${fmtTime(s.durationMs)}` : ""}</span></span>
                  <button className="rg-btn rg-btn-primary !min-h-9" onClick={() => void recoverUpload(s)}>Upload now</button>
                  <button className="rg-btn !min-h-9" onClick={() => void downloadLocal(s)}><Download className="size-4" aria-hidden />Download</button>
                  <button className="rg-btn rg-btn-danger !min-h-9" onClick={() => void discardLocal(s)}>Discard</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold">What to record</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <label key={m.id} className={`cursor-pointer rounded-xl border p-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[color:var(--brand)] ${mode === m.id ? "border-[color:var(--brand)] bg-[color:color-mix(in_srgb,var(--brand)_8%,white)] ring-1 ring-[color:var(--brand)]" : "border-[color:var(--rg-line)]"}`}>
                <input type="radio" name="mode" value={m.id} checked={mode === m.id} onChange={() => { setError(null); setMode(m.id); }} className="sr-only" />
                <span className="text-[color:var(--brand)]">{m.icon}</span>
                <span className="mt-2 block text-sm font-semibold">{m.title}</span>
                <span className="block text-xs text-[color:var(--rg-muted)]">{m.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {needCam && (
            <div>
              <label htmlFor="cam" className="text-sm font-semibold">Camera</label>
              <select id="cam" className="rg-input mt-1" value={camId} onChange={(e) => setCamId(e.target.value)}>
                <option value="">Default camera</option>
                {cams.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="mic" className="text-sm font-semibold">Microphone</label>
            <select id="mic" className="rg-input mt-1" value={micId} onChange={(e) => setMicId(e.target.value)}>
              <option value="">Default microphone</option>
              {mics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              <option value="none">No microphone</option>
            </select>
            {needMic && (
              <div className="mt-2 flex items-center gap-2" >
                <div role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%`, background: level > 0.85 ? "var(--rg-bad)" : "var(--rg-ok)" }} />
                </div>
                <span className="w-24 text-xs text-[color:var(--rg-muted)]">{level > 0.05 ? "Hearing you" : "Say something"}</span>
              </div>
            )}
          </div>
          {mode !== "cam" && (
            <div>
              <label className="flex min-h-10 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={captureAudio} onChange={(e) => setCaptureAudio(e.target.checked)} className="size-4" />
                Capture tab / system audio
              </label>
              <p className="text-xs text-[color:var(--rg-muted)]">Mixed with your microphone. Availability depends on browser, OS and what you share.</p>
            </div>
          )}
          <div>
            <label htmlFor="q" className="text-sm font-semibold">Quality</label>
            <select id="q" className="rg-input mt-1" value={height} onChange={(e) => setHeight(Number(e.target.value) as 720 | 1080)}>
              <option value={1080}>1080p (sharper text)</option>
              <option value={720}>720p (smaller files)</option>
            </select>
          </div>
        </div>

        {mode === "screen-cam" && (
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">Camera bubble</legend>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(Object.keys(OVERLAY_CORNERS) as (keyof typeof OVERLAY_CORNERS)[]).map((k) => {
                const on = Math.abs(overlay.x - OVERLAY_CORNERS[k].x) < 0.01 && Math.abs(overlay.y - OVERLAY_CORNERS[k].y) < 0.01;
                return <button key={k} aria-pressed={on} onClick={() => setOv({ ...OVERLAY_CORNERS[k] })} className={`rg-btn !min-h-9 capitalize ${on ? "!border-[color:var(--brand)] !bg-[color:color-mix(in_srgb,var(--brand)_8%,white)]" : ""}`}>{k.replace("-", " ")}</button>;
              })}
              <span className="mx-1 text-slate-300" aria-hidden>|</span>
              {(["s", "m", "l"] as const).map((k) => (
                <button key={k} aria-pressed={overlay.size === SIZES[k]} onClick={() => setOv({ size: SIZES[k] })} className={`rg-btn !min-h-9 uppercase ${overlay.size === SIZES[k] ? "!border-[color:var(--brand)] !bg-[color:color-mix(in_srgb,var(--brand)_8%,white)]" : ""}`}>{k}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-[color:var(--rg-muted)]">You can also hide or move the bubble while recording.</p>
          </fieldset>
        )}

        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-[color:var(--rg-bad)]">{error}</p>}
        <Notices notices={notices} />

        <button onClick={() => void begin()} disabled={busy || !usable || (needCam && camOk === false)} className="rg-btn rg-btn-primary mt-6 !min-h-12 !px-8 !text-base">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <span aria-hidden className="size-3 rounded-full bg-[color:var(--brand-accent)] ring-2 ring-white/70" />}
          {busy ? "Waiting for permission…" : "Start recording"}
        </button>
        {!usable && <p className="mt-2 text-sm text-[color:var(--rg-bad)]">This browser can’t record this way. See “What this browser can do”.</p>}

        <ol aria-label="What happens next" className="mt-8 flex flex-wrap gap-2 text-xs text-[color:var(--rg-muted)]">
          {STATES.map((s, i) => (<li key={s} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">{i + 1}</span>{s}{i < 3 && <span aria-hidden>→</span>}</li>))}
        </ol>
      </section>

      <aside className="space-y-4">
        <div className="rg-card p-4">
          <h2 className="text-sm font-semibold">Camera preview</h2>
          <div className={`mt-2 grid place-items-center overflow-hidden bg-slate-100 ${mode === "cam" ? "aspect-video rounded-xl" : "mx-auto aspect-square w-48 rounded-full"}`}>
            {needCam && camOk ? <video ref={previewVideo} autoPlay muted playsInline aria-label="Camera preview" className="size-full -scale-x-100 object-cover" /> : <Camera className="size-10 text-slate-400" aria-hidden />}
          </div>
          {!needCam && <p className="mt-2 text-center text-xs text-[color:var(--rg-muted)]">Camera is off for screen-only recordings.</p>}
        </div>
        <div className="rg-card p-4">
          <h2 className="text-sm font-semibold">What this browser can do</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {caps.items.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${c.ok ? "bg-[color:var(--rg-ok)]" : "bg-slate-400"}`}>{c.ok ? "✓" : "–"}</span>
                <span><span className="font-medium">{c.label}</span><span className="sr-only">{c.ok ? " available" : " not available"}</span>{c.note && <span className="block text-xs text-[color:var(--rg-muted)]">{c.note}</span>}</span>
              </li>
            ))}
          </ul>
          {storeKind === "memory" && <p className="mt-3 rounded bg-amber-50 p-2 text-xs text-amber-900">Local backup is unavailable in this window (private mode or blocked storage). Keep the tab open until upload finishes.</p>}
        </div>
      </aside>
    </div>
  );
}

function Notices({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  return (
    <ul className="mt-4 space-y-2" role="status" aria-live="polite">
      {notices.map((n) => (
        <li key={n.code} className={`rounded-lg p-3 text-sm ${n.level === "error" ? "bg-red-50 text-[color:var(--rg-bad)]" : n.level === "warn" ? "bg-amber-50 text-amber-900" : "bg-blue-50 text-blue-900"}`}>{n.message}</li>
      ))}
    </ul>
  );
}

function UploadPanel({ state, failed, error, onRetry, onBack }: { state: UploadState | null; failed: boolean; error: string | null; onRetry: () => void; onBack: () => void }) {
  const pct = state?.totalBytes ? Math.min(100, Math.round((state.uploadedBytes / state.totalBytes) * 100)) : null;
  const label = failed ? "Upload paused" : state?.status === "finalizing" ? "Finishing up…" : state?.status === "stalled" ? "Upload interrupted" : "Uploading your recording";
  return (
    <div className="rg-card p-8" role="region" aria-label="Upload progress">
      <h1 className="text-xl font-bold">{label}</h1>
      <p className="mt-1 text-sm text-[color:var(--rg-muted)]">
        {failed ? "Your recording is safe on this device. Retry when you’re ready." : "Keep this tab open. Your recording is also saved on this device, so an interruption won’t lose it."}
      </p>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined} aria-label="Upload progress">
        <div className={`h-full rounded-full transition-[width] ${pct === null ? "w-1/3 animate-pulse" : ""}`} style={{ width: pct === null ? undefined : `${pct}%`, background: "var(--brand)" }} />
      </div>
      <p className="mt-2 text-sm tabular-nums" aria-live="polite">
        {pct !== null ? `${pct}% · ${fmtBytes(state!.uploadedBytes)} of ${fmtBytes(state!.totalBytes!)}` : "Preparing…"}
      </p>
      {(state?.error || error) && <p role="alert" className={`mt-3 text-sm ${failed || state?.status === "error" ? "text-[color:var(--rg-bad)]" : "text-amber-800"}`}>{error || state?.error}</p>}
      <div className="mt-5 flex gap-2">
        {(failed || state?.status === "stalled") && <button className="rg-btn rg-btn-primary" onClick={onRetry}><RotateCcw className="size-4" aria-hidden />Retry now</button>}
        {failed && <button className="rg-btn" onClick={onBack}>Back</button>}
      </div>
    </div>
  );
}
