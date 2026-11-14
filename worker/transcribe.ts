import { readFile } from "node:fs/promises";
import { env } from "../src/lib/server/env";

export type Seg = { startMs: number; endMs: number; text: string };
export interface Transcriber {
  /** Transcribe one audio file; timestamps are relative to the start of that file. */
  transcribe(path: string, durationMs: number): Promise<Seg[]>;
}

/** OpenAI-compatible /audio/transcriptions (works with OpenAI, Groq, and self-hosted Whisper servers). */
export function openaiCompatible(): Transcriber {
  const c = env.transcribe;
  if (!c.apiKey) throw new Error("TRANSCRIBE_API_KEY is not set");
  return {
    async transcribe(path) {
      const form = new FormData();
      form.set("file", new Blob([await readFile(path)], { type: "audio/mpeg" }), "audio.mp3");
      form.set("model", c.model);
      form.set("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "segment");
      const res = await fetch(`${c.baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${c.apiKey}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Transcription provider returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = (await res.json()) as { segments?: { start: number; end: number; text: string }[]; text?: string; duration?: number };
      if (j.segments?.length) return j.segments.map((s) => ({ startMs: Math.round(s.start * 1000), endMs: Math.round(s.end * 1000), text: s.text.trim() })).filter((s) => s.text);
      return j.text?.trim() ? [{ startMs: 0, endMs: Math.round((j.duration ?? 1) * 1000), text: j.text.trim() }] : [];
    },
  };
}

/** Deterministic provider for tests/demos. NOT speech recognition. */
export function mock(): Transcriber {
  const lines = (process.env.MOCK_TRANSCRIPT_LINES || "Welcome to the RiseGenie walkthrough.|First, open the dashboard and look at the overview.|Next, click the settings tab to configure notifications.|Here we enable the weekly report for the client.|That is everything, thanks for watching.").split("|");
  return {
    async transcribe(_path, durationMs) {
      const step = Math.max(1000, Math.floor(durationMs / lines.length));
      return lines.map((text, i) => ({ startMs: i * step, endMs: Math.min(durationMs, (i + 1) * step), text })).filter((s) => s.startMs < durationMs);
    },
  };
}

export function getTranscriber(): Transcriber | null {
  switch (env.transcribe.provider) {
    case "openai":
      return openaiCompatible();
    case "mock":
      if (env.isProd) throw new Error("TRANSCRIBE_PROVIDER=mock is not allowed in production");
      return mock();
    default:
      return null;
  }
}
