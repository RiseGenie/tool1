import { one, query } from "./db";
import { notFound } from "./http";
import { getStorage } from "./storage";
import { MEDIA_TTL_SEC, type Recording } from "./recordings";

export type Sop = { id: string; recording_id: string; owner_id: string; title: string; status: string; error: string | null; generator: string | null; generation: number; generated_from_revision: number | null; reviewed_at: string | null; created_at: string; updated_at: string };
export type Step = { id: string; sop_id: string; idx: number; title: string; body: string; at_ms: number; screenshot_key: string | null; edited: boolean };

export async function getOwnedSop(id: string, userId: string): Promise<Sop> {
  const s = await one<Sop>(`select * from sops where id=$1 and owner_id=$2`, [id, userId]);
  if (!s) throw notFound();
  return s;
}

export const stepsOf = (sopId: string) => query<Step>(`select * from sop_steps where sop_id=$1 order by idx`, [sopId]);

/** Any edit invalidates the author's sign-off: the reviewed text must be the exported text. */
export const touch = (sopId: string) => query(`update sops set reviewed_at=null, updated_at=now() where id=$1`, [sopId]);

export async function sopView(sop: Sop, rec: Recording) {
  const st = getStorage();
  const steps = await stepsOf(sop.id);
  return {
    id: sop.id, recordingId: sop.recording_id, title: sop.title, status: sop.status, error: sop.error, generator: sop.generator,
    reviewed: !!sop.reviewed_at, reviewedAt: sop.reviewed_at, stale: sop.generated_from_revision !== null && sop.generated_from_revision !== rec.revision,
    versionNo: rec.version_no, durationMs: rec.duration_ms,
    steps: await Promise.all(steps.map(async (s) => ({
      id: s.id, idx: s.idx, title: s.title, body: s.body, atMs: s.at_ms, edited: s.edited,
      screenshotUrl: s.screenshot_key ? await st.presignGet(s.screenshot_key, { ttlSec: MEDIA_TTL_SEC, contentType: "image/jpeg" }) : null,
    }))),
  };
}

const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** One renderer for both formats; screenshots are inlined so the file is self-contained (no expiring URLs). */
export async function renderExport(sop: Sop, rec: Recording, format: "md" | "html", watchBase: string | null) {
  const st = getStorage();
  const steps = await stepsOf(sop.id);
  const imgs = await Promise.all(steps.map(async (s) => {
    if (!s.screenshot_key) return null;
    const stream = await st.readStream(s.screenshot_key);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    return `data:image/jpeg;base64,${Buffer.concat(chunks).toString("base64")}`;
  }));
  const link = (ms: number) => (watchBase ? `${watchBase}${watchBase.includes("?") ? "&" : "?"}t=${ms}` : null);
  if (format === "md") {
    let out = `# ${sop.title}\n\n_Source video: version ${rec.version_no}, ${fmt(rec.duration_ms ?? 0)}. Reviewed ${new Date(sop.reviewed_at!).toISOString().slice(0, 10)}._\n\n`;
    steps.forEach((s, i) => {
      out += `## Step ${i + 1}: ${s.title}\n\n`;
      if (s.body) out += `${s.body}\n\n`;
      if (imgs[i]) out += `![Step ${i + 1} screenshot](${imgs[i]})\n\n`;
      const l = link(s.at_ms);
      out += l ? `[Watch this step at ${fmt(s.at_ms)}](${l})\n\n` : `_Video time ${fmt(s.at_ms)}_\n\n`;
    });
    return out;
  }
  let html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sop.title)}</title></head><body><h1>${esc(sop.title)}</h1><p><em>Source video: version ${rec.version_no}, ${fmt(rec.duration_ms ?? 0)}.</em></p>`;
  steps.forEach((s, i) => {
    html += `<h2>Step ${i + 1}: ${esc(s.title)}</h2>${s.body ? `<p>${esc(s.body)}</p>` : ""}${imgs[i] ? `<p><img src="${imgs[i]}" alt="Step ${i + 1} screenshot" width="640"></p>` : ""}`;
    const l = link(s.at_ms);
    html += l ? `<p><a href="${esc(l)}">Watch this step at ${fmt(s.at_ms)}</a></p>` : `<p><em>Video time ${fmt(s.at_ms)}</em></p>`;
  });
  return html + "</body></html>";
}
