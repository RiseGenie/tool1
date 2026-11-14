"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Download,
  Link2,
  Maximize,
  MessageSquare,
  Pause,
  Play,
  Send,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteClip, getClip, newId, updateClip, type ClipMeta } from "@/lib/clips/store";
import { extensionFor, formatBytes, formatDuration, timeAgo } from "@/lib/clips/format";

const EMOJI = ["👍", "❤️", "🎉", "👏", "😂"];
const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function Watch({ id }: { id: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<ClipMeta | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let live = true;
    getClip(id)
      .then((c) => {
        if (!live) return;
        if (!c) return setMissing(true);
        url = URL.createObjectURL(c.blob);
        setMeta(c.meta);
        setTitle(c.meta.title);
        setSrc(url);
      })
      .catch(() => live && setMissing(true));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  const duration = meta?.duration ?? 0;

  // MediaRecorder output has no duration header, which breaks seeking. Force the browser to scan the file.
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || Number.isFinite(v.duration)) return;
    const fix = () => {
      v.removeEventListener("timeupdate", fix);
      v.currentTime = 0;
    };
    v.addEventListener("timeupdate", fix);
    v.currentTime = 1e101;
  };

  const seek = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.min(Math.max(0, t), duration || t);
      setTime(v.currentTime);
    },
    [duration],
  );

  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === " " || e.key === "k") {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft") seek((videoRef.current?.currentTime ?? 0) - 5);
      else if (e.key === "ArrowRight") seek((videoRef.current?.currentTime ?? 0) + 5);
      else if (e.key === "f") void playerRef.current?.requestFullscreen?.();
      else if (e.key === "m") setMuted((m) => !m);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, seek]);

  async function patch(p: Partial<ClipMeta>) {
    const next = await updateClip(id, p);
    if (next) setMeta(next);
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !meta) return;
    setDraft("");
    await patch({
      comments: [...meta.comments, { id: newId(), at: videoRef.current?.currentTime ?? 0, text, createdAt: Date.now() }],
    });
  }

  async function react(emoji: string) {
    if (!meta) return;
    await patch({ reactions: { ...meta.reactions, [emoji]: (meta.reactions[emoji] ?? 0) + 1 } });
  }

  async function download() {
    if (!meta || !src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `${meta.title.replace(/[^\w\- ]+/g, "").trim() || "clip"}.${extensionFor(meta.mimeType)}`;
    a.click();
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function remove() {
    if (!confirm("Delete this clip permanently?")) return;
    await deleteClip(id);
    router.push("/clips");
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h1 className="text-xl font-semibold">Clip not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          Clips are stored privately in the browser that recorded them, so this link only opens there.
        </p>
        <Link href="/clips" className="mt-5 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  if (!meta || !src) return <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />;

  const comments = [...meta.comments].sort((a, b) => a.at - b.at);
  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div>
      <Link href="/clips" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Library
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div ref={playerRef} className="group relative overflow-hidden rounded-2xl bg-black shadow-lg">
            <video
              ref={videoRef}
              src={src}
              poster={meta.thumbnail}
              muted={muted}
              onClick={toggle}
              onLoadedMetadata={onLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
              playsInline
              className="aspect-video w-full cursor-pointer bg-black"
            />
            {!playing && (
              <button
                onClick={toggle}
                aria-label="Play"
                className="absolute inset-0 grid place-items-center bg-black/20"
              >
                <span className="grid size-16 place-items-center rounded-full bg-white/95 text-indigo-600 shadow-xl">
                  <Play className="size-7 fill-current" />
                </span>
              </button>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 text-white">
              <div
                className="relative h-5 cursor-pointer"
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  seek(((e.clientX - r.left) / r.width) * duration);
                }}
              >
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/30">
                  <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                </div>
                {comments.map((c) => (
                  <span
                    key={c.id}
                    title={c.text}
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 ring-2 ring-black/40"
                    style={{ left: `${duration ? (c.at / duration) * 100 : 0}%` }}
                  />
                ))}
                <span
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                  style={{ left: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center gap-3 text-sm">
                <button onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
                  {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
                </button>
                <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"}>
                  {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
                </button>
                <span className="font-mono text-xs tabular-nums">
                  {formatDuration(time)} / {formatDuration(duration)}
                </span>
                <div className="flex-1" />
                <select
                  value={speed}
                  onChange={(e) => {
                    const s = Number(e.target.value);
                    setSpeed(s);
                    if (videoRef.current) videoRef.current.playbackRate = s;
                  }}
                  aria-label="Playback speed"
                  className="rounded bg-white/15 px-1.5 py-0.5 text-xs outline-none"
                >
                  {SPEEDS.map((s) => (
                    <option key={s} value={s} className="text-black">
                      {s}×
                    </option>
                  ))}
                </select>
                <button onClick={() => void playerRef.current?.requestFullscreen?.()} aria-label="Fullscreen">
                  <Maximize className="size-5" />
                </button>
              </div>
            </div>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== meta.title && void patch({ title: title.trim() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Clip title"
            className="mt-5 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold tracking-tight outline-none hover:border-slate-200 focus:border-indigo-500 focus:bg-white"
          />
          <p className="px-2 text-sm text-slate-500">
            {timeAgo(meta.createdAt)} · {formatDuration(meta.duration)} · {formatBytes(meta.size)} · saved privately in this
            browser
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => void react(e)}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm transition hover:border-indigo-300 hover:bg-indigo-50"
              >
                {e}
                {meta.reactions[e] ? <span className="text-xs font-medium text-slate-600">{meta.reactions[e]}</span> : null}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={copyLink}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              {copied ? <Check className="size-4 text-emerald-600" /> : <Link2 className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              onClick={download}
              className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Download className="size-4" /> Download
            </button>
            <button
              onClick={remove}
              aria-label="Delete clip"
              className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        <aside className="flex h-fit flex-col rounded-2xl border border-slate-200 bg-white shadow-sm lg:max-h-[calc(100dvh-8rem)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-medium">
            <MessageSquare className="size-4 text-slate-500" /> Comments
            <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">{comments.length}</span>
          </div>
          <ul className="min-h-24 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {comments.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-slate-500">
                Pause on a moment and leave a timestamped note.
              </li>
            )}
            {comments.map((c) => (
              <li key={c.id} className="group flex gap-3 px-5 py-3">
                <button
                  onClick={() => {
                    seek(c.at);
                    void videoRef.current?.play();
                  }}
                  className="h-fit shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-xs text-indigo-700 hover:bg-indigo-100"
                >
                  {formatDuration(c.at)}
                </button>
                <p className="min-w-0 flex-1 break-words text-sm">{c.text}</p>
                <button
                  onClick={() => void patch({ comments: meta.comments.filter((x) => x.id !== c.id) })}
                  aria-label="Delete comment"
                  className="h-fit text-slate-300 opacity-0 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <form onSubmit={addComment} className="flex items-center gap-2 border-t border-slate-100 p-3">
            <span className="rounded-md bg-slate-100 px-1.5 py-1 font-mono text-xs text-slate-600">
              {formatDuration(time)}
            </span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500"
            />
            <button
              disabled={!draft.trim()}
              aria-label="Post comment"
              className={cn(
                "grid size-9 place-items-center rounded-lg bg-indigo-600 text-white transition",
                !draft.trim() && "opacity-40",
              )}
            >
              <Send className="size-4" />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
