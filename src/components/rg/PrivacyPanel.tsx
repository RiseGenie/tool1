"use client";

import { useState } from "react";
import { EyeOff, Plus, Trash2, VolumeX } from "lucide-react";
import { fmtTime } from "./StatusBadge";

export type Redactions = {
  blurs: { x: number; y: number; w: number; h: number; startMs: number; endMs: number }[];
  mutes: { startMs: number; endMs: number }[];
  transcript: { phrases: string[]; segments: number[] };
};
export type RawSeg = { idx: number; text: string; sourceStartMs: number };

const pct = (n: number) => Math.round(n * 100);

/** Region blur, audio mute and transcript redaction. Times are on the ORIGINAL timeline. Saving re-renders a sanitized video. */
export function PrivacyPanel({ value, rawSegments, playheadSourceMs, sourceDurationMs, disabled, onSave }: {
  value: Redactions; rawSegments: RawSeg[]; playheadSourceMs: number; sourceDurationMs: number; disabled: boolean; onSave: (r: Redactions) => Promise<void>;
}) {
  const [r, setR] = useState<Redactions>(value);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(r) !== JSON.stringify(value);
  const upBlur = (i: number, p: Partial<Redactions["blurs"][number]>) => setR((o) => ({ ...o, blurs: o.blurs.map((b, j) => (j === i ? { ...b, ...p } : b)) }));
  const upMute = (i: number, p: Partial<Redactions["mutes"][number]>) => setR((o) => ({ ...o, mutes: o.mutes.map((b, j) => (j === i ? { ...b, ...p } : b)) }));
  const clampT = (ms: number) => Math.max(0, Math.min(sourceDurationMs, Math.round(ms)));

  if (disabled) return <div className="rg-card p-4"><h2 className="flex items-center gap-2 font-semibold"><EyeOff className="size-4" aria-hidden />Privacy editing</h2><p className="mt-2 text-sm text-[color:var(--rg-muted)]">Unavailable while processing, or because this version is locked by a review. Create a new version to redact.</p></div>;

  return (
    <div className="rg-card space-y-4 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><EyeOff className="size-4" aria-hidden />Privacy editing</h2>
      <p className="text-sm text-[color:var(--rg-muted)]">Blurs and mutes are baked into a new sanitized video. Captions, transcript, thumbnails and downloads all come from that version.</p>

      <section aria-label="Blur regions">
        <h3 className="text-sm font-semibold">Blur regions</h3>
        <ul className="mt-2 space-y-3">
          {r.blurs.map((b, i) => (
            <li key={i} className="rounded-lg border border-[color:var(--rg-line)] p-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="block">
                    <span className="flex justify-between"><span>{{ x: "Left", y: "Top", w: "Width", h: "Height" }[k]}</span><span className="font-mono">{pct(b[k])}%</span></span>
                    <input type="range" min={k === "w" || k === "h" ? 2 : 0} max={100} value={pct(b[k])} onChange={(e) => upBlur(i, { [k]: Number(e.target.value) / 100 })} className="w-full accent-[color:var(--brand)]" aria-label={`Blur ${i + 1} ${k}`} />
                  </label>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{fmtTime(b.startMs)}–{fmtTime(b.endMs)}</span>
                <button className="rg-btn !min-h-8" onClick={() => upBlur(i, { startMs: clampT(playheadSourceMs), endMs: Math.max(clampT(playheadSourceMs) + 500, b.endMs) })}>Start at playhead</button>
                <button className="rg-btn !min-h-8" onClick={() => upBlur(i, { endMs: Math.max(clampT(playheadSourceMs), b.startMs + 500) })}>End at playhead</button>
                <button className="rg-btn rg-btn-danger !min-h-8" aria-label={`Remove blur ${i + 1}`} onClick={() => setR((o) => ({ ...o, blurs: o.blurs.filter((_, j) => j !== i) }))}><Trash2 className="size-4" aria-hidden /></button>
              </div>
            </li>
          ))}
        </ul>
        <button className="rg-btn mt-2" onClick={() => setR((o) => ({ ...o, blurs: [...o.blurs, { x: 0.25, y: 0.25, w: 0.4, h: 0.25, startMs: clampT(playheadSourceMs), endMs: clampT(playheadSourceMs + 3000) }] }))}><Plus className="size-4" aria-hidden />Add blur at playhead</button>
        <p className="mt-1 text-xs text-[color:var(--rg-muted)]">A dashed box previews each blur on the player while the playhead is inside its time range.</p>
      </section>

      <section aria-label="Muted audio">
        <h3 className="flex items-center gap-1 text-sm font-semibold"><VolumeX className="size-4" aria-hidden />Mute audio</h3>
        <ul className="mt-2 space-y-2">
          {r.mutes.map((m, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs">{fmtTime(m.startMs)}–{fmtTime(m.endMs)}</span>
              <button className="rg-btn !min-h-8" onClick={() => upMute(i, { startMs: clampT(playheadSourceMs), endMs: Math.max(clampT(playheadSourceMs) + 500, m.endMs) })}>Start at playhead</button>
              <button className="rg-btn !min-h-8" onClick={() => upMute(i, { endMs: Math.max(clampT(playheadSourceMs), m.startMs + 500) })}>End at playhead</button>
              <button className="rg-btn rg-btn-danger !min-h-8" aria-label={`Remove mute ${i + 1}`} onClick={() => setR((o) => ({ ...o, mutes: o.mutes.filter((_, j) => j !== i) }))}><Trash2 className="size-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
        <button className="rg-btn mt-2" onClick={() => setR((o) => ({ ...o, mutes: [...o.mutes, { startMs: clampT(playheadSourceMs), endMs: clampT(playheadSourceMs + 2000) }] }))}><Plus className="size-4" aria-hidden />Mute from playhead</button>
        <p className="mt-1 text-xs text-[color:var(--rg-muted)]">Transcript lines inside a muted range are redacted automatically.</p>
      </section>

      <section aria-label="Transcript redaction">
        <h3 className="text-sm font-semibold">Redact transcript &amp; captions</h3>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const p = phrase.trim(); if (p && !r.transcript.phrases.includes(p)) setR((o) => ({ ...o, transcript: { ...o.transcript, phrases: [...o.transcript.phrases, p] } })); setPhrase(""); }}>
          <label className="sr-only" htmlFor="redact-phrase">Word or phrase to redact</label>
          <input id="redact-phrase" className="rg-input" placeholder="Word or phrase (every occurrence)" value={phrase} onChange={(e) => setPhrase(e.target.value)} maxLength={200} />
          <button className="rg-btn">Add</button>
        </form>
        {r.transcript.phrases.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{r.transcript.phrases.map((p) => <li key={p} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm">{p}<button aria-label={`Remove ${p}`} className="font-bold" onClick={() => setR((o) => ({ ...o, transcript: { ...o.transcript, phrases: o.transcript.phrases.filter((x) => x !== p) } }))}>×</button></li>)}</ul>}
        {rawSegments.length > 0 && (
          <details className="mt-2"><summary className="cursor-pointer text-sm font-semibold">Redact whole lines ({r.transcript.segments.length})</summary>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {rawSegments.map((s) => (
                <li key={s.idx}><label className="flex min-h-9 items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4" checked={r.transcript.segments.includes(s.idx)} onChange={(e) => setR((o) => ({ ...o, transcript: { ...o.transcript, segments: e.target.checked ? [...o.transcript.segments, s.idx] : o.transcript.segments.filter((x) => x !== s.idx) } }))} /><span><span className="font-mono text-xs">{fmtTime(s.sourceStartMs)}</span> {s.text}</span></label></li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <button className="rg-btn rg-btn-primary" disabled={!dirty || busy} onClick={async () => { setBusy(true); try { await onSave(r); } finally { setBusy(false); } }}>Save &amp; render sanitized version</button>
    </div>
  );
}

export function BlurPreview({ blurs, sourceMs }: { blurs: Redactions["blurs"]; sourceMs: number }) {
  return (
    <>
      {blurs.filter((b) => sourceMs >= b.startMs && sourceMs <= b.endMs).map((b, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute border-2 border-dashed border-amber-300 bg-amber-300/20" style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }} />
      ))}
    </>
  );
}
