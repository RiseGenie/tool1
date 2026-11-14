// Transcripts and comments are stored on the SOURCE timeline. Trimming is non-destructive, so everything the
// viewer sees is mapped onto the EDITED timeline: editMs = sourceMs - trimStart, and items outside the kept range are dropped
// (transcript) or clamped and flagged (comments).
export type Trim = { trim_start_ms: number; trim_end_ms: number | null; source_duration_ms: number | null };

export function trimBounds(t: Trim): { start: number; end: number } {
  const end = t.trim_end_ms ?? t.source_duration_ms ?? Number.MAX_SAFE_INTEGER;
  return { start: t.trim_start_ms, end };
}

export function mapSegments<T extends { start_ms: number; end_ms: number }>(segs: T[], t: Trim): (T & { start_ms: number; end_ms: number })[] {
  const { start, end } = trimBounds(t);
  return segs
    .filter((s) => s.end_ms > start && s.start_ms < end)
    .map((s) => ({ ...s, start_ms: Math.max(0, s.start_ms - start), end_ms: Math.min(end, s.end_ms) - start }));
}

export function mapPoint(sourceMs: number, t: Trim): { ms: number; outside: boolean } {
  const { start, end } = trimBounds(t);
  const outside = sourceMs < start || sourceMs > end;
  return { ms: Math.max(0, Math.min(sourceMs, end) - start), outside };
}

export const editToSource = (editMs: number, t: Trim) => Math.max(0, editMs) + t.trim_start_ms;

export function vttTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const f = Math.floor(ms % 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(f, 3)}`;
}

export function toVtt(segs: { start_ms: number; end_ms: number; text: string }[]): string {
  const body = segs
    .map((s, i) => `${i + 1}\n${vttTime(s.start_ms)} --> ${vttTime(Math.max(s.end_ms, s.start_ms + 500))}\n${s.text.replace(/-->/g, "→").trim()}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}
