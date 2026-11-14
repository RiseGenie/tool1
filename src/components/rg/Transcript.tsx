"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fmtTime } from "./StatusBadge";

export type Segment = { startMs: number; endMs: number; text: string };

export function Transcript({ segments, status, currentMs, onSeek }: { segments: Segment[]; status: string; currentMs: number; onSeek: (ms: number) => void }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (needle ? segments.filter((s) => s.text.toLowerCase().includes(needle)) : segments), [segments, needle]);

  if (status !== "ready") {
    const msg =
      status === "disabled" ? "Transcripts aren’t enabled for this workspace." :
      status === "none" ? "No speech was detected, so there’s no transcript." :
      status === "failed" ? "The transcript couldn’t be generated." :
      "Transcript is being generated. The video is already playable.";
    return <p role="status" className="p-4 text-sm text-[color:var(--rg-muted)]">{msg}</p>;
  }

  const mark = (text: string) => {
    if (!needle) return text;
    const i = text.toLowerCase().indexOf(needle);
    return i < 0 ? text : (
      <>
        {text.slice(0, i)}<mark className="rounded bg-yellow-200 px-0.5">{text.slice(i, i + needle.length)}</mark>{text.slice(i + needle.length)}
      </>
    );
  };

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search transcript</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transcript" className="rg-input pl-9" />
      </label>
      <p className="sr-only" role="status" aria-live="polite">{needle ? `${shown.length} matching lines` : ""}</p>
      <ol className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto pr-1">
        {shown.length === 0 && <li className="p-2 text-sm text-[color:var(--rg-muted)]">No matches.</li>}
        {shown.map((s) => {
          const active = currentMs >= s.startMs && currentMs < s.endMs;
          return (
            <li key={`${s.startMs}-${s.text.slice(0, 12)}`}>
              <button
                onClick={() => onSeek(s.startMs)}
                aria-current={active ? "true" : undefined}
                className={`flex min-h-11 w-full gap-3 rounded-lg p-2 text-left text-sm hover:bg-slate-100 ${active ? "bg-[color:color-mix(in_srgb,var(--brand)_10%,white)]" : ""}`}
              >
                <span className="shrink-0 font-mono text-xs font-semibold text-[color:var(--brand)] underline-offset-2">{fmtTime(s.startMs)}</span>
                <span>{mark(s.text)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
