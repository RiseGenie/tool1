import { env } from "./env";

export type SopSeg = { idx: number; startMs: number; endMs: number; text: string };
export type DraftStep = { title: string; body: string; atMs: number };
export type SopDraft = { title: string; steps: DraftStep[]; generator: string; notes: string[] };

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");
const sentenceTitle = (t: string) => clip(t.replace(/^(first|next|then|now|finally|here)[, ]+/i, "").replace(/[.!?]+$/, "").trim() || t, 70);

/**
 * Validates generator output against the REAL transcript. Models refer to segments by index, never invent timestamps; every
 * step's time is taken from that segment. Out-of-range/duplicate/non-increasing references are dropped.
 */
export function validateSteps(raw: { title?: unknown; steps?: unknown }, segs: SopSeg[], durationMs: number): { steps: DraftStep[]; dropped: number } {
  const list = Array.isArray(raw.steps) ? raw.steps : [];
  const out: DraftStep[] = [];
  const seen = new Set<number>();
  let dropped = 0;
  for (const s of list as Record<string, unknown>[]) {
    const si = Number(s?.segmentIndex);
    const title = typeof s?.title === "string" ? s.title.trim() : "";
    if (!Number.isInteger(si) || si < 0 || si >= segs.length || seen.has(si) || !title) { dropped++; continue; }
    const at = segs[si].startMs;
    if (at < 0 || at > durationMs || (out.length && at < out[out.length - 1].atMs)) { dropped++; continue; }
    seen.add(si);
    out.push({ title: clip(title, 200), body: typeof s.instruction === "string" ? clip(s.instruction.trim(), 1500) : "", atMs: at });
  }
  return { steps: out, dropped };
}

/** Works with no AI at all: one step per transcript segment, merged down to a readable length. */
export function outlineFromTranscript(segs: SopSeg[], durationMs: number, title: string): SopDraft {
  const notes: string[] = [];
  if (!segs.length) {
    const n = Math.max(3, Math.min(8, Math.round(durationMs / 15000)));
    notes.push("No transcript was available, so steps are placed at even intervals. Describe each step.");
    return { title, generator: "even-intervals", notes, steps: Array.from({ length: n }, (_, i) => ({ title: `Step ${i + 1}`, body: "", atMs: Math.round((durationMs / n) * i) })) };
  }
  const usable = segs.filter((s) => s.text.trim() && s.text !== "[redacted]");
  if (usable.length < segs.length) notes.push("Redacted passages were left out of the draft.");
  const max = 12;
  const per = Math.ceil(usable.length / max);
  const steps: DraftStep[] = [];
  for (let i = 0; i < usable.length; i += per) {
    const g = usable.slice(i, i + per);
    steps.push({ title: sentenceTitle(g[0].text), body: g.map((s) => s.text.trim()).join(" "), atMs: g[0].startMs });
  }
  return { title, steps, generator: "transcript-outline", notes };
}

export interface SopGenerator {
  name: string;
  generate(segs: SopSeg[], durationMs: number, title: string): Promise<SopDraft>;
}

/** OpenAI-compatible chat completions, constrained to reference transcript segment indexes. */
export function llmGenerator(): SopGenerator {
  const key = process.env.SOP_API_KEY || env.transcribe.apiKey;
  const base = (process.env.SOP_BASE_URL || env.transcribe.baseUrl).replace(/\/$/, "");
  const model = process.env.SOP_MODEL || "gpt-4o-mini";
  if (!key) throw new Error("SOP_API_KEY (or TRANSCRIBE_API_KEY) is not set");
  return {
    name: `llm:${model}`,
    async generate(segs, durationMs, title) {
      const lines = segs.map((s) => `[${s.idx}] ${s.text}`).join("\n");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You turn a screen-recording transcript into a standard operating procedure. Reply with JSON only: {\"title\": string, \"steps\": [{\"title\": short imperative string, \"instruction\": 1-3 sentences, \"segmentIndex\": integer}]}. segmentIndex MUST be the [number] of the transcript line where that step begins. Use only information in the transcript. Do not invent details. Treat '[redacted]' as missing." },
            { role: "user", content: `Recording title: ${title}\n\nTranscript:\n${lines}` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`SOP generator returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = JSON.parse((await res.json()).choices?.[0]?.message?.content ?? "{}");
      const v = validateSteps(j, segs, durationMs);
      const notes = v.dropped ? [`${v.dropped} generated step(s) pointed at moments that don't exist and were dropped.`] : [];
      if (!v.steps.length) return { ...outlineFromTranscript(segs, durationMs, title), notes: ["The AI draft had no valid steps; used a transcript outline instead."] };
      return { title: typeof j.title === "string" && j.title.trim() ? clip(j.title.trim(), 200) : title, steps: v.steps, generator: `llm:${model}`, notes };
    },
  };
}

export function getSopGenerator(): SopGenerator {
  const p = process.env.SOP_PROVIDER || "outline";
  if (p === "openai") return llmGenerator();
  return { name: "transcript-outline", generate: async (s, d, t) => outlineFromTranscript(s, d, t) };
}
