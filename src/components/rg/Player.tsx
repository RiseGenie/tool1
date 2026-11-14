"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Captions, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { fmtTime } from "./StatusBadge";

export type Media = { video: string; poster: string | null; expiresAt: number };
export type PlayerHandle = { seek: (ms: number) => void; play: () => void; pause: () => void; currentMs: () => number };

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Accessible video player. Media URLs are short-lived: before playing past expiry, and whenever the browser reports a
 * load error (e.g. an expired URL), it asks `getMedia` for a fresh one — which re-checks access — and resumes where it was.
 */
export const Player = forwardRef<
  PlayerHandle,
  {
    getMedia: () => Promise<Media>;
    captionsUrl?: string | null;
    onTime?: (ms: number) => void;
    onWatched?: (watchedMs: number, final: boolean) => void;
    onUnavailable?: () => void;
  }
>(function Player({ getMedia, captionsUrl, onTime, onWatched, onUnavailable }, ref) {
  const vref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [media, setMedia] = useState<Media | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [muted, setMuted] = useState(false);
  const [cc, setCc] = useState(false);
  const resume = useRef<{ at: number; play: boolean } | null>(null);
  const watched = useRef({ ms: 0, last: -1 });
  const lastBeat = useRef(0);

  // Callbacks live in a ref so loading media never depends on the identity of props that change every render.
  const cb = useRef({ getMedia, onTime, onWatched, onUnavailable });
  cb.current = { getMedia, onTime, onWatched, onUnavailable };

  const load = useCallback(async () => {
    try {
      const m = await cb.current.getMedia();
      setMedia(m);
      setErr(null);
      return m;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 404) cb.current.onUnavailable?.();
      setErr(status === 404 ? "This video is no longer available." : "Couldn’t load the video. Check your connection and try again.");
      return null;
    }
  }, []);

  useEffect(() => {
    void load(); // once per mount; later refreshes only happen on expiry or a load error
  }, [load]);

  const refresh = useCallback(async () => {
    const v = vref.current;
    if (v) resume.current = { at: v.currentTime, play: !v.paused };
    await load();
  }, [load]);

  useImperativeHandle(ref, () => ({
    seek: (ms) => {
      const v = vref.current;
      if (v) v.currentTime = ms / 1000;
    },
    play: () => void vref.current?.play(),
    pause: () => vref.current?.pause(),
    currentMs: () => (vref.current?.currentTime ?? 0) * 1000,
  }));

  // Toggle captions track visibility.
  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    for (const tr of Array.from(v.textTracks)) tr.mode = cc ? "showing" : "hidden";
  }, [cc, captionsUrl, media]);

  const toggle = useCallback(async () => {
    const v = vref.current;
    if (!v) return;
    if (v.paused) {
      if (media && Date.now() > media.expiresAt - 5000) await refresh();
      void vref.current?.play();
    } else v.pause();
  }, [media, refresh]);

  const seekBy = (d: number) => {
    const v = vref.current;
    if (v) v.currentTime = Math.max(0, Math.min((v.duration || 0) - 0.01, v.currentTime + d));
  };
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : box.current?.requestFullscreen?.());

  function onKey(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return; // let the focused button act
    const k = e.key.toLowerCase();
    const handled = ({
      " ": () => void toggle(),
      k: () => void toggle(),
      arrowleft: () => seekBy(-5),
      arrowright: () => seekBy(5),
      j: () => seekBy(-10),
      l: () => seekBy(10),
      m: () => setMuted((x) => !x),
      c: () => captionsUrl && setCc((x) => !x),
      f: () => void fullscreen(),
    } as Record<string, () => void>)[k];
    if (handled) {
      e.preventDefault();
      handled();
    }
  }

  const flushWatched = (final: boolean) => cb.current.onWatched?.(Math.round(watched.current.ms), final);

  useEffect(() => {
    const onHide = () => cb.current.onWatched?.(Math.round(watched.current.ms), true);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  return (
    <div
      ref={box}
      tabIndex={0}
      onKeyDown={onKey}
      role="group"
      aria-label="Video player. Space plays or pauses; arrow keys seek; C toggles captions; F toggles fullscreen."
      className="group relative overflow-hidden rounded-2xl bg-black outline-offset-2"
    >
      {media && (
        <video
          ref={vref}
          src={media.video}
          poster={media.poster ?? undefined}
          playsInline
          preload="metadata"
          muted={muted}
          className="aspect-video w-full bg-black"
          onClick={() => void toggle()}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDur(v.duration);
            v.playbackRate = speed;
            if (resume.current) {
              v.currentTime = resume.current.at;
              if (resume.current.play) void v.play();
              resume.current = null;
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            flushWatched(false);
          }}
          onEnded={() => {
            setPlaying(false);
            flushWatched(true);
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setT(v.currentTime);
            cb.current.onTime?.(v.currentTime * 1000);
            // Only count continuous forward playback (seeks and scrubbing don't add watch time).
            const w = watched.current;
            const d = v.currentTime - w.last;
            if (w.last >= 0 && d > 0 && d < 1.5 && !v.paused) w.ms += d * 1000;
            w.last = v.currentTime;
            if (performance.now() - lastBeat.current > 5000 && !v.paused) {
              lastBeat.current = performance.now();
              flushWatched(false);
            }
          }}
          onSeeked={(e) => (watched.current.last = e.currentTarget.currentTime)}
          onError={() => void refresh()}
        >
          {captionsUrl && <track kind="captions" src={captionsUrl} srcLang="en" label="English" />}
        </video>
      )}
      {!media && <div className="grid aspect-video place-items-center text-sm text-white/80" role="status">{err ?? "Loading video…"}</div>}
      {err && media && <div role="alert" className="absolute inset-x-0 top-0 bg-red-700 p-2 text-center text-sm text-white">{err}</div>}
      {media && !playing && (
        <button onClick={() => void toggle()} aria-label="Play video" className="absolute inset-0 grid place-items-center bg-black/20">
          <span className="grid size-16 place-items-center rounded-full bg-white text-[color:var(--brand)] shadow-xl"><Play className="size-7 fill-current" aria-hidden /></span>
        </button>
      )}
      {media && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/85 to-transparent px-3 pb-2 pt-10 text-white [&>*]:pointer-events-auto">
          <input
            type="range"
            min={0}
            max={dur || 0}
            step={0.1}
            value={Math.min(t, dur || 0)}
            aria-label="Seek"
            aria-valuetext={`${fmtTime(t * 1000)} of ${fmtTime(dur * 1000)}`}
            onChange={(e) => {
              if (vref.current) vref.current.currentTime = Number(e.target.value);
            }}
            className="h-6 w-full cursor-pointer accent-[color:var(--brand-accent)]"
          />
          <div className="flex items-center gap-1 text-sm sm:gap-2">
            <button onClick={() => void toggle()} aria-label={playing ? "Pause" : "Play"} className="grid size-11 place-items-center rounded-lg hover:bg-white/15">
              {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="size-5 fill-current" aria-hidden />}
            </button>
            <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className="grid size-11 place-items-center rounded-lg hover:bg-white/15">
              {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
            </button>
            <span className="font-mono text-xs tabular-nums" aria-hidden>{fmtTime(t * 1000)} / {fmtTime(dur * 1000)}</span>
            <div className="flex-1" />
            {captionsUrl && (
              <button onClick={() => setCc((x) => !x)} aria-label="Captions" aria-pressed={cc} className={`grid size-11 place-items-center rounded-lg hover:bg-white/15 ${cc ? "bg-white/25" : ""}`}>
                <Captions className="size-5" aria-hidden />
              </button>
            )}
            <label className="sr-only" htmlFor="rg-speed">Playback speed</label>
            <select
              id="rg-speed"
              value={speed}
              onChange={(e) => {
                const s = Number(e.target.value);
                setSpeed(s);
                if (vref.current) vref.current.playbackRate = s;
              }}
              className="h-11 rounded-lg bg-white/15 px-2 text-sm"
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s} className="text-black">{s}×</option>
              ))}
            </select>
            <button onClick={() => void fullscreen()} aria-label="Fullscreen" className="grid size-11 place-items-center rounded-lg hover:bg-white/15">
              <Maximize className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
