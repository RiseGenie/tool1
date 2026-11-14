import { createHmac } from "node:crypto";
import { one, query } from "./db";
import { notFound } from "./http";
import { getStorage } from "./storage";

export type Bug = {
  id: string; owner_id: string; recording_id: string | null; title: string; steps: string; expected: string; actual: string; severity: string;
  diagnostics: Record<string, string>; include_link: boolean; status: string; tracker: string | null; tracker_ref: string | null; tracker_error: string | null;
  submitted_at: string | null; created_at: string; updated_at: string;
};
export type Attachment = { id: string; report_id: string; filename: string; mime_type: string; size_bytes: string; storage_key: string };

/** Everything the page may collect. The server keeps only these keys (and trims values), whatever the client sends. */
export const DIAGNOSTIC_KEYS = {
  userAgent: "Browser", platform: "Operating system", language: "Language", timezone: "Time zone", viewport: "Window size",
  screen: "Screen size", pixelRatio: "Pixel ratio", online: "Online", cores: "CPU cores", memoryGb: "Device memory (GB)", connection: "Connection type", appBuild: "App version",
} as const;
export type DiagKey = keyof typeof DIAGNOSTIC_KEYS;

export function cleanDiagnostics(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object")
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (k in DIAGNOSTIC_KEYS && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) out[k] = String(v).slice(0, 300);
  return out;
}

export async function getOwnedBug(id: string, userId: string): Promise<Bug> {
  const b = await one<Bug>(`select * from bug_reports where id=$1 and owner_id=$2`, [id, userId]);
  if (!b) throw notFound();
  return b;
}

export const attachmentsOf = (id: string) => query<Attachment>(`select * from bug_attachments where report_id=$1 order by created_at`, [id]);

export type Payload = { title: string; body: string; severity: string; attachments: { filename: string; mimeType: string; sizeBytes: number }[]; recordingUrl: string | null; diagnostics: Record<string, string> };

/** Exactly what is sent to the tracker — the preview endpoint returns this same object. */
export function buildPayload(b: Bug, atts: Attachment[], recordingUrl: string | null): Payload {
  const diag = Object.entries(b.diagnostics).map(([k, v]) => `- **${DIAGNOSTIC_KEYS[k as DiagKey] ?? k}:** ${v}`).join("\n");
  const body = [
    `## Steps to reproduce\n${b.steps.trim() || "_Not provided_"}`,
    `## Expected behavior\n${b.expected.trim() || "_Not provided_"}`,
    `## Actual behavior\n${b.actual.trim() || "_Not provided_"}`,
    `**Severity:** ${b.severity}`,
    recordingUrl ? `## Recording\n${recordingUrl}` : "",
    atts.length ? `## Attachments\n${atts.map((a) => `- ${a.filename} (${a.mime_type}, ${Math.round(Number(a.size_bytes) / 1024)} KB)`).join("\n")}` : "",
    diag ? `## Diagnostics (shared by the reporter)\n${diag}` : "",
  ].filter(Boolean).join("\n\n");
  return { title: b.title.trim(), body, severity: b.severity, attachments: atts.map((a) => ({ filename: a.filename, mimeType: a.mime_type, sizeBytes: Number(a.size_bytes) })), recordingUrl, diagnostics: b.diagnostics };
}

// ---------- tracker adapters ----------
export interface Tracker {
  name: string;
  send(p: Payload, ctx: { reportId: string; attachmentUrls: { filename: string; url: string }[] }): Promise<{ ref: string }>;
}

export function configuredTracker(): Tracker | null {
  const t = process.env.BUG_TRACKER || "none";
  if (t === "github") {
    const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO;
    if (!token || !repo) return null;
    const api = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "");
    return {
      name: "github",
      async send(p) {
        const res = await fetch(`${api}/repos/${repo}/issues`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "rg-recorder" },
          body: JSON.stringify({ title: p.title, body: p.body, labels: ["bug", `severity:${p.severity}`] }),
        });
        if (!res.ok) throw new Error(`GitHub returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const j = (await res.json()) as { html_url?: string; number?: number };
        return { ref: j.html_url || `#${j.number}` };
      },
    };
  }
  if (t === "webhook") {
    const url = process.env.BUG_WEBHOOK_URL;
    if (!url) return null;
    const secret = process.env.BUG_WEBHOOK_SECRET;
    return {
      name: "webhook",
      async send(p, ctx) {
        const body = JSON.stringify({ event: "bug_report.submitted", reportId: ctx.reportId, ...p, attachmentUrls: ctx.attachmentUrls });
        const headers: Record<string, string> = { "content-type": "application/json", "idempotency-key": ctx.reportId };
        if (secret) headers["x-rg-signature"] = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
        const res = await fetch(url, { method: "POST", headers, body });
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
        return { ref: `webhook:${ctx.reportId}` };
      },
    };
  }
  return null;
}

export function bugView(b: Bug, atts: Attachment[]) {
  return {
    id: b.id, recordingId: b.recording_id, title: b.title, steps: b.steps, expected: b.expected, actual: b.actual, severity: b.severity, diagnostics: b.diagnostics,
    includeLink: b.include_link, status: b.status, tracker: b.tracker, trackerRef: b.tracker_ref, trackerError: b.tracker_error, submittedAt: b.submitted_at, createdAt: b.created_at,
    attachments: atts.map((a) => ({ id: a.id, filename: a.filename, mimeType: a.mime_type, sizeBytes: Number(a.size_bytes) })),
    trackerConfigured: !!configuredTracker(),
  };
}

export const attachmentUrl = (key: string, ttlSec: number, filename: string) => getStorage().presignGet(key, { ttlSec, filename });
