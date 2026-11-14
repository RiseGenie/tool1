"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare, Play, Search, Trash2, Video } from "lucide-react";
import { deleteClip, listClips, type ClipMeta } from "@/lib/clips/store";
import { formatBytes, formatDuration, timeAgo } from "@/lib/clips/format";

export function Library() {
  const [clips, setClips] = useState<ClipMeta[] | null>(null);
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  useEffect(() => {
    let live = true;
    listClips()
      .then((c) => live && setClips(c))
      .catch(() => live && setClips([]));
    navigator.storage?.estimate?.().then((e) => {
      if (live && e.quota) setUsage({ used: e.usage ?? 0, quota: e.quota });
    });
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(
    () => (clips ?? []).filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase())),
    [clips, query],
  );

  async function remove(id: string) {
    if (!confirm("Delete this clip permanently?")) return;
    await deleteClip(id);
    setClips((c) => (c ?? []).filter((x) => x.id !== id));
  }

  if (clips === null) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;

  if (clips.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white px-8 py-16 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Video className="size-7" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Record your first clip</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
          Capture your screen and camera in seconds. Everything stays private in your browser — nothing is uploaded.
        </p>
        <Link
          href="/clips/record"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <span className="size-2 rounded-full bg-rose-300" /> Start recording
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your library</h1>
          <p className="mt-1 text-sm text-slate-500">
            {clips.length} clip{clips.length === 1 ? "" : "s"}
            {usage && ` · ${formatBytes(usage.used)} of ${formatBytes(usage.quota)} browser storage used`}
          </p>
        </div>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clips"
            className="h-10 w-64 rounded-full border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="mt-12 text-center text-sm text-slate-500">No clips match “{query}”.</p>
      ) : (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <li key={c.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <Link href={`/clips/watch/${c.id}`} className="relative block aspect-video bg-slate-900">
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.thumbnail} alt="" className="size-full object-cover" />
                ) : (
                  <div className="grid size-full place-items-center text-slate-600">
                    <Video className="size-8" />
                  </div>
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                  <span className="grid size-12 place-items-center rounded-full bg-white/95 text-indigo-600">
                    <Play className="size-5 fill-current" />
                  </span>
                </span>
                <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">
                  {formatDuration(c.duration)}
                </span>
              </Link>
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/clips/watch/${c.id}`} className="block truncate text-sm font-medium hover:text-indigo-600">
                    {c.title}
                  </Link>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {timeAgo(c.createdAt)} · {formatBytes(c.size)}
                    {c.comments.length > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-3" /> {c.comments.length}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => remove(c.id)}
                  aria-label={`Delete ${c.title}`}
                  className="rounded-md p-1.5 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
