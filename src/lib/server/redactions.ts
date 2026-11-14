import { z } from "zod";

// All times are on the SOURCE timeline (like transcripts), so redactions survive re-trimming.
const range = z.object({ startMs: z.number().int().min(0), endMs: z.number().int().min(1) }).refine((r) => r.endMs > r.startMs, "end must be after start");
export const redactionsSchema = z.object({
  blurs: z
    .array(
      z
        .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.01).max(1), h: z.number().min(0.01).max(1) })
        .and(range),
    )
    .max(50)
    .refine((a) => a.every((b) => b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001), "blur region must stay inside the frame"),
  mutes: z.array(range).max(50),
  transcript: z.object({ phrases: z.array(z.string().trim().min(1).max(200)).max(50), segments: z.array(z.number().int().min(0)).max(2000) }),
});
export type Redactions = z.infer<typeof redactionsSchema>;
export const emptyRedactions = (): Redactions => ({ blurs: [], mutes: [], transcript: { phrases: [], segments: [] } });

export function normalizeRedactions(raw: unknown): Redactions {
  const p = redactionsSchema.safeParse({ ...emptyRedactions(), ...(raw as object) });
  return p.success ? p.data : emptyRedactions();
}

/** Does a change require re-rendering the video? (Transcript-only edits never do.) */
export const needsRender = (a: Redactions, b: Redactions) => JSON.stringify([a.blurs, a.mutes]) !== JSON.stringify([b.blurs, b.mutes]);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Seg = { idx: number; start_ms: number; end_ms: number; text: string };

/**
 * Applied on every read that leaves the owner's editor: captions (VTT), transcript API, guest search, SOP input.
 * A segment is redacted if: it was marked, it overlaps a muted range (the audio is gone, so the words must be too),
 * or it contains a redacted phrase (case-insensitive; the phrase alone is replaced).
 */
export function redactSegments<T extends Seg>(rows: T[], r: Redactions): T[] {
  const phrases = r.transcript.phrases.map((p) => new RegExp(esc(p), "gi"));
  const marked = new Set(r.transcript.segments);
  return rows.map((s) => {
    const muted = r.mutes.some((m) => s.end_ms > m.startMs && s.start_ms < m.endMs);
    if (marked.has(s.idx) || muted) return { ...s, text: "[redacted]" };
    let text = s.text;
    for (const re of phrases) text = text.replace(re, "[redacted]");
    return text === s.text ? s : { ...s, text };
  });
}
