"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Loader2,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  Square,
  Trash2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/clips/format";
import { newId, saveClip } from "@/lib/clips/store";
import {
  ClipRecorder,
  recordingSupported,
  screenCaptureSupported,
  type CamPosition,
  type CamSize,
  type RecordMode,
} from "@/lib/clips/recorder";

type Phase = "setup" | "starting" | "countdown" | "recording" | "saving";

const MODES: { id: RecordMode; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: "screen-cam", label: "Screen + Camera", hint: "Your screen with a face bubble", icon: <Monitor className="size-5" /> },
  { id: "screen", label: "Screen only", hint: "Just your display", icon: <Monitor className="size-5" /> },
  { id: "cam", label: "Camera only", hint: "Talk straight to the lens", icon: <Camera className="size-5" /> },
];

const POSITIONS: CamPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
const SIZES: { id: CamSize; label: string }[] = [
  { id: "s", label: "S" },
  { id: "m", label: "M" },
  { id: "l", label: "L" },
];

export function Recorder() {
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [mode, setMode] = useState<RecordMode>("screen-cam");
  const [mic, setMic] = useState(true);
  const [camPosition, setCamPosition] = useState<CamPosition>("bottom-left");
  const [camSize, setCamSize] = useState<CamSize>("m");
  const [phase, setPhase] = useState<Phase>("setup");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const recRef = useRef<ClipRecorder | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [camReady, setCamReady] = useState(false);
  const phaseRef = useRef<Phase>("setup");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    // Feature detection can only run in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(recordingSupported() && screenCaptureSupported());
  }, []);

  // Webcam preview in the setup screen.
  const needsCam = mode !== "screen";
  useEffect(() => {
    if (!needsCam || phase !== "setup" || supported !== true) return;
    if (camStreamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        camStreamRef.current = s;
        setCamReady(true);
        if (previewRef.current) previewRef.current.srcObject = s;
      })
      .catch(() => {
        if (!cancelled) setError("Camera access was blocked. Allow it in your browser, or pick “Screen only”.");
      });
    return () => {
      cancelled = true;
    };
  }, [needsCam, phase, supported]);

  useEffect(() => {
    if (camReady && previewRef.current && camStreamRef.current) {
      previewRef.current.srcObject = camStreamRef.current;
    }
  }, [camReady, phase]);

  const stopCam = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCamReady(false);
  }, []);

  // Release hardware on unmount.
  useEffect(
    () => () => {
      recRef.current?.cancel();
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // Live timer + tab title so the user can see status while presenting in another window.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = window.setInterval(() => {
      const t = recRef.current?.elapsed ?? 0;
      setElapsed(t);
      document.title = `${recRef.current?.isPaused ? "⏸" : "● REC"} ${formatDuration(t)} — Glimpse`;
    }, 250);
    return () => {
      window.clearInterval(id);
      document.title = "Glimpse";
    };
  }, [phase]);

  const finish = useCallback(async () => {
    const rec = recRef.current;
    if (!rec || phaseRef.current === "saving") return;
    setPhase("saving");
    try {
      const result = await rec.stop();
      recRef.current = null;
      stopCam();
      if (result.blob.size === 0 || result.duration < 0.5) {
        setError("That recording was empty, so nothing was saved.");
        setPhase("setup");
        return;
      }
      const id = newId();
      const d = new Date();
      await saveClip(
        {
          id,
          title: `Recording ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
          createdAt: Date.now(),
          duration: result.duration,
          size: result.blob.size,
          mimeType: result.mimeType,
          thumbnail: result.thumbnail,
          comments: [],
          reactions: {},
        },
        result.blob,
      );
      router.push(`/clips/watch/${id}`);
    } catch {
      setError("Couldn't save the recording. Your browser may be out of storage.");
      setPhase("setup");
    }
  }, [router, stopCam]);

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  async function begin() {
    setError(null);
    setNotice(null);
    setPhase("starting");
    try {
      const rec = await ClipRecorder.create({
        mode,
        mic,
        camPosition,
        camSize,
        camStream: camStreamRef.current,
        onCaptureEnded: () => {
          // User clicked the browser's "Stop sharing" button.
          if (phaseRef.current === "recording") void finishRef.current();
          else if (phaseRef.current === "countdown") cancel();
        },
      });
      recRef.current = rec;
      if (mic && !rec.hasMic) setNotice("Microphone unavailable — recording without your voice.");
      setPhase("countdown");
      for (let i = 3; i > 0; i--) {
        setCount(i);
        await new Promise((r) => setTimeout(r, 1000));
        if (phaseRef.current !== "countdown") return; // cancelled
      }
      rec.start();
      setElapsed(0);
      setPaused(false);
      setPhase("recording");
    } catch (e) {
      recRef.current?.cancel();
      recRef.current = null;
      const name = (e as DOMException)?.name;
      setError(
        name === "NotAllowedError"
          ? "Permission was denied. Choose what to share when your browser asks."
          : "Couldn't start recording. Try again.",
      );
      setPhase("setup");
    }
  }

  function cancel() {
    recRef.current?.cancel();
    recRef.current = null;
    setPhase("setup");
  }

  function togglePause() {
    const rec = recRef.current;
    if (!rec) return;
    if (rec.isPaused) rec.resume();
    else rec.pause();
    setPaused(rec.isPaused);
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Recording isn’t supported here</h1>
        <p className="mt-2 text-sm text-slate-600">
          Screen capture needs a desktop browser such as Chrome, Edge, Firefox or Safari 13+ (over HTTPS or localhost).
        </p>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 backdrop-blur-sm">
        <div className="text-center text-white">
          <div key={count} className="animate-[pop_1s_ease-out] text-9xl font-bold tabular-nums">
            {count}
          </div>
          <p className="mt-4 text-sm text-white/70">Switch to the window you’re sharing — recording starts now.</p>
          <button onClick={cancel} className="mt-6 rounded-full border border-white/30 px-4 py-2 text-sm hover:bg-white/10">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-rose-600">
          <span className={cn("size-2.5 rounded-full bg-rose-600", !paused && "animate-pulse")} />
          {paused ? "Paused" : "Recording"}
        </div>
        <div className="mt-3 font-mono text-5xl font-semibold tabular-nums">{formatDuration(elapsed)}</div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={togglePause}
            className="grid size-12 place-items-center rounded-full border border-slate-200 hover:bg-slate-50"
            aria-label={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
          </button>
          <button
            onClick={() => void finish()}
            className="flex h-12 items-center gap-2 rounded-full bg-rose-600 px-6 font-medium text-white hover:bg-rose-700"
          >
            <Square className="size-4 fill-current" /> Stop &amp; save
          </button>
          <button
            onClick={cancel}
            className="grid size-12 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
            aria-label="Discard"
          >
            <Trash2 className="size-5" />
          </button>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Switch to the window you’re sharing — we keep recording. Use your browser’s “Stop sharing” button or come back
          here to finish.
        </p>
      </div>
    );
  }

  if (phase === "saving") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <Loader2 className="size-7 animate-spin text-indigo-600" />
        <p className="font-medium">Saving your clip…</p>
      </div>
    );
  }

  const busy = phase === "starting";
  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">New recording</h1>
        <p className="mt-1 text-sm text-slate-600">Pick what to capture. Clips are saved privately in this browser.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition",
                mode === m.id ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-slate-200 hover:border-slate-300",
              )}
            >
              <div className={cn("mb-2", mode === m.id ? "text-indigo-600" : "text-slate-500")}>{m.icon}</div>
              <div className="text-sm font-medium">{m.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{m.hint}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-6">
          <button
            onClick={() => setMic((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              mic ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600",
            )}
          >
            {mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
            Microphone {mic ? "on" : "off"}
          </button>

          {mode === "screen-cam" && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">Bubble</span>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 p-1">
                  {POSITIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setCamPosition(p)}
                      aria-label={p.replace("-", " ")}
                      className={cn(
                        "size-5 rounded-sm transition",
                        camPosition === p ? "bg-indigo-600" : "bg-slate-200 hover:bg-slate-300",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="mr-1 text-slate-500">Size</span>
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setCamSize(s.id)}
                    className={cn(
                      "size-8 rounded-lg border text-xs font-medium",
                      camSize === s.id ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {error && <p className="mt-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {notice && <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>}

        <button
          onClick={begin}
          disabled={busy}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto sm:px-8"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <span className="size-3 rounded-full bg-rose-400" />}
          {busy ? "Waiting for permission…" : "Start recording"}
        </button>
        <p className="mt-3 text-xs text-slate-500">
          {mode === "cam" ? "" : "You’ll choose a screen, window or tab next. Tick “share audio” to include system sound."}
        </p>
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium text-slate-500">Camera preview</h2>
        <div
          className={cn(
            "mt-3 grid aspect-square place-items-center overflow-hidden bg-slate-100",
            mode === "screen-cam" ? "rounded-full" : "rounded-xl",
            mode === "cam" && "aspect-video",
          )}
        >
          {needsCam && camReady ? (
            <video ref={previewRef} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
          ) : (
            <div className="text-center text-slate-400">
              <User className="mx-auto size-10" />
              <p className="mt-2 text-xs">{needsCam ? "Starting camera…" : "Camera is off"}</p>
            </div>
          )}
        </div>
        <ul className="mt-5 space-y-2 text-xs text-slate-500">
          {["Records up to your device’s limits — no time cap", "Pause & resume anytime", "Nothing is uploaded"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="size-3.5 text-emerald-600" /> {t}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
