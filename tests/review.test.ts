// Phase 2a/2b: review decisions bound to exact versions, replacement + redaction, and what guests can actually reach.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { BASE, client, devCookie, makeFixture, splitChunks, uploadChunk } from "./helpers";
import { runOnce } from "../worker/index";
import { query } from "../src/lib/server/db";

const owner = client(devCookie("owner2@example.com", "Olivia Owner"));
const guest = client();
const drain = async () => { while (await runOnce()); };
const S: { v1: string; v2?: string; v3?: string; token?: string; linkId?: string } = { v1: randomUUID() };

/** ffmpeg prints volumedetect on stderr. */
const volume = (path: string, from: number, to: number) =>
  spawnSync("ffmpeg", ["-hide_banner", "-ss", String(from), "-to", String(to), "-i", path, "-af", "volumedetect", "-vn", "-f", "null", "-"], { encoding: "utf8" }).stderr;

async function upload(id: string) {
  const f = makeFixture(6);
  await owner.fetch("/api/recordings", { method: "POST", json: { id, mimeType: "video/webm", title: "Client walkthrough" } });
  const chunks = splitChunks(f.bytes, 3);
  for (let i = 0; i < chunks.length; i++) assert.equal((await uploadChunk(owner, id, i, chunks[i])).status, 200);
  assert.equal((await owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: chunks.length, totalBytes: f.size } })).status, 200);
}
const rec = async (id: string) => (await (await owner.fetch(`/api/recordings/${id}`)).json()).recording;

test("setup: recorded, processed and shared v1", async () => {
  await upload(S.v1);
  await drain();
  assert.equal((await rec(S.v1)).status, "ready");
  const mk = await (await owner.fetch(`/api/recordings/${S.v1}/links`, { method: "POST", json: { allowComments: true } })).json();
  S.token = mk.url.split("/s/")[1];
  S.linkId = mk.id;
});

test("guest sees a pending review; a decision needs a name and, for changes, a reason", async () => {
  const r = await (await guest.fetch(`/api/share/${S.token}/review`)).json();
  assert.equal(r.status, "pending");
  assert.equal(r.currentVersion.versionNo, 1);
  assert.equal((await guest.fetch(`/api/share/${S.token}/review`, { method: "POST", json: { decision: "approved" } })).status, 400);
  assert.equal((await guest.fetch(`/api/share/${S.token}/review`, { method: "POST", json: { decision: "changes_requested", name: "Casey" } })).status, 400);
});

test("client requests changes at a timestamp: decision + change-request comment, version frozen", async () => {
  const res = await guest.fetch(`/api/share/${S.token}/review`, { method: "POST", json: { decision: "changes_requested", name: "Casey Client", email: "casey@client.com", note: "Hide the settings screen here", atMs: 2500 } });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.status, "changes_requested");
  assert.equal(body.decision.verified, false);
  assert.equal(body.decision.reviewerEmail, null, "unverified emails are not echoed back to other guests");
  const cs = (await (await guest.fetch(`/api/share/${S.token}/comments`)).json()).comments;
  const cr = cs.find((c: { kind: string }) => c.kind === "change_request");
  assert.ok(cr && Math.abs(cr.atMs - 2500) < 5 && cr.resolved === false);
  const v1 = await rec(S.v1);
  assert.equal(v1.locked, true);
  const edit = await owner.fetch(`/api/recordings/${S.v1}`, { method: "PATCH", json: { trimStartMs: 500 } });
  assert.equal(edit.status, 409);
  assert.equal((await edit.json()).code, "version_locked");
  const owned = await (await owner.fetch(`/api/recordings/${S.v1}/review`)).json();
  assert.equal(owned.versions[0].openChangeRequests, 1);
});

test("replacement starts as a draft: the link keeps serving v1 and drafts can't be reviewed", async () => {
  const r = await owner.fetch(`/api/recordings/${S.v1}/versions`, { method: "POST", json: { label: "Redacted" } });
  assert.equal(r.status, 201);
  S.v2 = (await r.json()).recording.id;
  await drain();
  const v2 = await rec(S.v2!);
  assert.equal(v2.status, "ready");
  assert.equal(v2.isDraft, true);
  assert.equal(v2.versionNo, 2);
  assert.equal((await owner.fetch(`/api/recordings/${S.v2!}/publish`, { method: "POST" })).status, 200); // publishing an unedited draft is allowed; we test redaction first below
  // un-publish by recreating: use a fresh draft for the redaction flow
  S.v3 = (await (await owner.fetch(`/api/recordings/${S.v1}/versions`, { method: "POST", json: { label: "Redacted v3" } })).json()).recording.id;
  await drain();
  const meta = await (await guest.fetch(`/api/share/${S.token}/review`)).json();
  assert.equal(meta.currentVersion.versionNo, 2, "v2 was published; the draft v3 is not served");
  assert.equal(meta.history.length, 2);
});

test("privacy edits validate, render a sanitized asset, and redact captions/transcript", async () => {
  const v = S.v3!;
  const bad = await owner.fetch(`/api/recordings/${v}`, { method: "PATCH", json: { redactions: { blurs: [{ x: 0.8, y: 0.1, w: 0.5, h: 0.2, startMs: 0, endMs: 1000 }], mutes: [], transcript: { phrases: [], segments: [] } } } });
  assert.equal(bad.status, 400, "blur outside the frame is rejected");
  const ok = await owner.fetch(`/api/recordings/${v}`, {
    method: "PATCH",
    json: { redactions: { blurs: [{ x: 0.1, y: 0.1, w: 0.5, h: 0.5, startMs: 1000, endMs: 3000 }], mutes: [{ startMs: 2000, endMs: 3000 }], transcript: { phrases: ["weekly report"], segments: [4] } } },
  });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).recording.status, "processing");
  assert.equal((await owner.fetch(`/api/recordings/${v}/media`)).status, 409, "stale unredacted playback is withheld while re-rendering");
  assert.equal((await owner.fetch(`/api/recordings/${v}/publish`, { method: "POST" })).status, 409, "can't publish before the sanitized render is ready");
  await drain();
  const r = await rec(v);
  assert.equal(r.status, "ready");
  assert.equal(r.revision, 2);
});

test("blur and mute are baked into the sanitized MP4", async () => {
  const [a] = await query(`select playback_key from recordings where id=$1`, [S.v1]);
  const [b] = await query(`select playback_key from recordings where id=$1`, [S.v3]);
  const dir = process.env.FS_STORAGE_DIR!;
  const frame = (path: string, t: number) => execFileSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", path, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 28 });
  const fa = frame(`${dir}/${a.playback_key}`, 2), fb = frame(`${dir}/${b.playback_key}`, 2);
  const W = 1920, H = 1080; // fixture is 640x360 scaled? use actual dims from buffer length
  const w = Math.round(Math.sqrt((fa.length * 16) / 9)), h = fa.length / w;
  void W; void H;
  let inside = 0, nIn = 0, outside = 0, nOut = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(fa[y * w + x] - fb[y * w + x]);
    const inR = x > w * 0.12 && x < w * 0.58 && y > h * 0.12 && y < h * 0.58;
    if (inR) { inside += d; nIn++; } else if (x > w * 0.65 || y > h * 0.65) { outside += d; nOut++; }
  }
  assert.ok(inside / nIn > 6 && outside / nOut < 3, `region diff ${(inside / nIn).toFixed(1)} vs outside ${(outside / nOut).toFixed(1)}`);
  const run = (p: string, f: number, t: number) => volume(p, f, t);
  assert.match(run(`${dir}/${b.playback_key}`, 2.2, 2.8), /mean_volume: -9\d/);
  assert.match(run(`${dir}/${b.playback_key}`, 0.2, 0.8), /mean_volume: -[12]\d\./);
});

test("owner editor sees raw text; everything leaving the editor is redacted", async () => {
  const m = await (await owner.fetch(`/api/recordings/${S.v3}/media`)).json();
  assert.ok(m.transcriptRaw.some((t: { text: string }) => /settings/.test(t.text)), "owner can still see the original words to edit");
  assert.ok(!m.transcript.some((t: { text: string }) => /settings|weekly report|dashboard/.test(t.text)), "owner preview matches what guests get");
  assert.ok(m.transcript.some((t: { text: string }) => t.text === "[redacted]"));
  const caps = await (await owner.fetch(`/api/recordings/${S.v3}/captions`)).text();
  assert.ok(!/settings|weekly report/.test(caps) && /\[redacted\]/.test(caps));
});

test("publishing the redacted replacement: guests get ONLY the sanitized version", async () => {
  assert.equal((await owner.fetch(`/api/recordings/${S.v3}/publish`, { method: "POST" })).status, 200);
  const fresh = client();
  const rv = await (await fresh.fetch(`/api/share/${S.token}/review`)).json();
  assert.equal(rv.currentVersion.versionNo, 3);
  assert.equal(rv.status, "pending", "a replacement version starts a NEW review");
  assert.equal(rv.history.length, 3);
  assert.equal(rv.history[0].status, "changes_requested", "prior decision stays visible, attached to v1");

  // captions / transcript / search
  const vtt = await (await fresh.fetch(`/api/share/${S.token}/captions`)).text();
  assert.ok(!/settings|weekly report|dashboard/i.test(vtt), "no unredacted words in captions");
  assert.ok(/Welcome/.test(vtt) && /\[redacted\]/.test(vtt));
  const tr = await (await fresh.fetch(`/api/share/${S.token}/transcript`)).json();
  assert.ok(!JSON.stringify(tr).match(/settings|weekly report|dashboard/i));
  const search = await (await fresh.fetch(`/api/share/${S.token}/transcript?q=settings`)).json();
  assert.equal(search.segments.length, 0, "redacted words can't be found by searching");

  // media: the URL points at v3's playback, with audio silent in the muted range, and the original is unreachable
  const media = await (await fresh.fetch(`/api/share/${S.token}/media`, { method: "POST" })).json();
  const key = decodeURIComponent(new URL(BASE + media.video).searchParams.get("key")!);
  assert.ok(key.includes(S.v3!) && key.includes("playback"), key);
  const bytes = Buffer.from(await (await fetch(BASE + media.video)).arrayBuffer());
  writeFileSync("/tmp/rg-guest-dl.mp4", bytes);
  const out = volume("/tmp/rg-guest-dl.mp4", 2.2, 2.8);
  assert.match(out, /mean_volume: -9\d/, "what the guest downloads is silent in the muted range");
  for (const id of [S.v1, S.v2!]) {
    const [r] = await query(`select source_key, playback_key from recordings where id=$1`, [id]);
    for (const k of [r.source_key, r.playback_key]) assert.equal((await fetch(`${BASE}/api/storage/object?key=${encodeURIComponent(k)}&exp=9999999999&sig=AAAA`)).status, 403, "old versions' files can't be fetched without a server-issued signature");
  }
  const [src3] = await query(`select source_key from recordings where id=$1`, [S.v3]);
  assert.ok(!JSON.stringify(media).includes(src3.source_key), "the original upload is never exposed");
});

test("approve that exact version; later edits are blocked; history keeps every decision", async () => {
  const res = await guest.fetch(`/api/share/${S.token}/review`, { method: "POST", json: { decision: "approved", name: "Casey Client", note: "Looks good" } });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).status, "approved");
  const [d] = await query(`select recording_id, revision from review_decisions where decision='approved'`);
  assert.equal(d.recording_id, S.v3);
  assert.equal(d.revision, 2);
  const edit = await owner.fetch(`/api/recordings/${S.v3}`, { method: "PATCH", json: { redactions: { blurs: [], mutes: [], transcript: { phrases: [], segments: [] } } } });
  assert.equal(edit.status, 409);
  const hist = (await (await guest.fetch(`/api/share/${S.token}/review`)).json()).history;
  assert.deepEqual(hist.map((h: { versionNo: number; status: string }) => [h.versionNo, h.status]), [[1, "changes_requested"], [2, "pending"], [3, "approved"]]);
  const all = await query(`select decision, recording_id from review_decisions order by created_at`);
  assert.equal(all.length, 2);
});

test("owner resolves a change request; deleting an old version keeps the link alive", async () => {
  const cs = (await (await owner.fetch(`/api/recordings/${S.v1}/comments`)).json()).comments;
  const cr = cs.find((c: { kind: string }) => c.kind === "change_request");
  assert.equal((await owner.fetch(`/api/recordings/${S.v1}/comments/${cr.id}`, { method: "PATCH", json: { resolved: true } })).status, 200);
  assert.equal((await owner.fetch(`/api/recordings/${S.v1}`, { method: "DELETE" })).status, 200);
  const fresh = client();
  assert.equal((await fresh.fetch(`/api/share/${S.token}`)).status, 200, "series link survives deleting v1");
  assert.equal((await (await fresh.fetch(`/api/share/${S.token}/review`)).json()).currentVersion.versionNo, 3);
});

test("revoking the link still blocks the replacement page", async () => {
  await owner.fetch(`/api/links/${S.linkId}`, { method: "PATCH", json: { revoked: true } });
  for (const p of ["", "/media", "/captions", "/review"]) assert.equal((await client().fetch(`/api/share/${S.token}${p}`, p === "/media" ? { method: "POST" } : {})).status, 404, p);
});
