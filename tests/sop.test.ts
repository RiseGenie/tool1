import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { client, devCookie, makeFixture, splitChunks, uploadChunk, BASE } from "./helpers";
import { runOnce } from "../worker/index";
import { validateSteps, getSopGenerator, outlineFromTranscript } from "../src/lib/server/sop";

const owner = client(devCookie("sop-owner@example.com", "Sam SOP"));
const drain = async () => { while (await runOnce()); };
const S: { id: string; sop?: string; red?: string } = { id: randomUUID() };
const sopOf = async (rid: string) => (await (await owner.fetch(`/api/recordings/${rid}/sop`)).json()).sop;

test("setup: upload + process", async () => {
  const f = makeFixture(6);
  await owner.fetch("/api/recordings", { method: "POST", json: { id: S.id, mimeType: "video/webm", title: "Onboarding a new client" } });
  const ch = splitChunks(f.bytes, 2);
  for (let i = 0; i < ch.length; i++) await uploadChunk(owner, S.id, i, ch[i]);
  await owner.fetch(`/api/uploads/${S.id}/finalize`, { method: "POST", json: { chunkCount: ch.length, totalBytes: f.size } });
  await drain();
  assert.equal(((await (await owner.fetch(`/api/recordings/${S.id}`)).json()).recording).transcriptStatus, "ready");
});

test("generated steps point at real transcript moments and have screenshots", async () => {
  const gen = await owner.fetch(`/api/recordings/${S.id}/sop`, { method: "POST" });
  assert.equal(gen.status, 202);
  assert.equal((await sopOf(S.id)).status, "generating");
  await drain();
  const sop = await sopOf(S.id);
  S.sop = sop.id;
  assert.equal(sop.status, "draft");
  assert.ok(sop.steps.length >= 3);
  const starts = new Set(((await (await owner.fetch(`/api/recordings/${S.id}/media`)).json()).transcript as { startMs: number }[]).map((t) => t.startMs));
  for (const s of sop.steps) {
    assert.ok(starts.has(s.atMs), `step "${s.title}" at ${s.atMs} is not a transcript moment`);
    assert.ok(s.screenshotUrl, "screenshot missing");
    const img = Buffer.from(await (await fetch(BASE + s.screenshotUrl)).arrayBuffer());
    assert.deepEqual([img[0], img[1]], [0xff, 0xd8], "screenshot is a JPEG");
  }
  assert.ok(sop.generator);
});

test("editing: validation, re-screenshot on time change, reorder, delete", async () => {
  const sop = await sopOf(S.id);
  const [a, b] = sop.steps;
  assert.equal((await owner.fetch(`/api/sops/${sop.id}/steps/${a.id}`, { method: "PATCH", json: { atMs: 99_999_999 } })).status, 400);
  assert.equal((await owner.fetch(`/api/sops/${sop.id}/steps/${a.id}`, { method: "PATCH", json: { title: "Open the client dashboard", body: "Sign in first." } })).status, 200);
  assert.equal((await owner.fetch(`/api/sops/${sop.id}/steps/${b.id}`, { method: "PATCH", json: { atMs: 4000 } })).status, 200);
  await drain();
  let now = await sopOf(S.id);
  const nb = now.steps.find((s: { id: string }) => s.id === b.id);
  assert.equal(nb.atMs, 4000);
  assert.notEqual(nb.screenshotUrl.split("&")[0], b.screenshotUrl.split("&")[0], "screenshot was re-taken for the new time");
  assert.equal(now.steps[0].title, "Open the client dashboard");
  assert.equal(now.steps[0].edited, true);
  await owner.fetch(`/api/sops/${sop.id}/steps/${b.id}`, { method: "PATCH", json: { move: "up" } });
  now = await sopOf(S.id);
  assert.equal(now.steps[0].id, b.id);
  const n0 = now.steps.length;
  const add = await owner.fetch(`/api/sops/${sop.id}/steps`, { method: "POST", json: { title: "Check the result", body: "", atMs: 5000 } });
  assert.equal(add.status, 201);
  await drain();
  assert.equal((await sopOf(S.id)).steps.length, n0 + 1);
  assert.equal((await owner.fetch(`/api/sops/${sop.id}/steps/${(await add.json()).id}`, { method: "DELETE" })).status, 200);
  const after = await sopOf(S.id);
  assert.deepEqual(after.steps.map((s: { idx: number }) => s.idx), after.steps.map((_: unknown, i: number) => i), "indexes stay contiguous");
});

test("export is blocked until reviewed, and edits clear the sign-off", async () => {
  const sop = await sopOf(S.id);
  const blocked = await owner.fetch(`/api/sops/${sop.id}/export?format=md`);
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, "not_reviewed");
  assert.equal((await owner.fetch(`/api/sops/${sop.id}`, { method: "PATCH", json: { reviewed: true } })).status, 200);
  const md = await owner.fetch(`/api/sops/${sop.id}/export?format=md`);
  assert.equal(md.status, 200);
  const text = await md.text();
  assert.match(text, /^# Onboarding a new client/);
  assert.match(text, /## Step 1: /);
  assert.match(text, /!\[Step 1 screenshot\]\(data:image\/jpeg;base64,/);
  assert.match(text, /_Video time 0:0\d_/, "no active link: plain timestamps, no dead links");
  // with a share link the steps deep-link to their moment
  const mk = await (await owner.fetch(`/api/recordings/${S.id}/links`, { method: "POST", json: {} })).json();
  assert.equal((await owner.fetch(`/api/sops/${sop.id}`, { method: "PATCH", json: { reviewed: true } })).status, 200);
  const md2 = await (await owner.fetch(`/api/sops/${sop.id}/export?format=md`)).text();
  assert.ok(md2.includes(`${mk.url}?t=`), "timestamp links use the live share link");
  const html = await owner.fetch(`/api/sops/${sop.id}/export?format=html`);
  assert.match(html.headers.get("content-type")!, /text\/html/);
  assert.match(await html.text(), /<h2>Step 1: /);
  await owner.fetch(`/api/sops/${sop.id}/steps/${sop.steps[0].id}`, { method: "PATCH", json: { body: "changed after review" } });
  assert.equal((await owner.fetch(`/api/sops/${sop.id}/export?format=md`)).status, 409, "editing invalidates the review");
  assert.equal((await client(devCookie("other-sop@example.com")).fetch(`/api/sops/${sop.id}`)).status, 404, "other users can't read it");
});

test("SOPs made from a redacted version never contain the redacted words", async () => {
  const v = (await (await owner.fetch(`/api/recordings/${S.id}/versions`, { method: "POST", json: { label: "Redacted" } })).json()).recording.id;
  S.red = v;
  await drain();
  const r = await owner.fetch(`/api/recordings/${v}`, { method: "PATCH", json: { redactions: { blurs: [], mutes: [{ startMs: 2400, endMs: 3600 }], transcript: { phrases: ["weekly report"], segments: [] } } } });
  assert.equal(r.status, 200);
  await drain();
  await owner.fetch(`/api/recordings/${v}/sop`, { method: "POST" });
  await drain();
  const sop = await sopOf(v);
  assert.equal(sop.status, "draft");
  const blob = JSON.stringify(sop.steps);
  assert.ok(!/settings|weekly report/i.test(blob), blob);
  assert.match(sop.error ?? "", /Redacted passages were left out/);
});

test("regeneration replaces the draft and clears review", async () => {
  const before = await sopOf(S.id);
  assert.equal((await owner.fetch(`/api/recordings/${S.id}/sop`, { method: "POST" })).status, 202);
  await drain();
  const after = await sopOf(S.id);
  assert.equal(after.id, before.id);
  assert.equal(after.reviewed, false);
  assert.ok(after.steps.every((s: { edited: boolean }) => !s.edited));
  assert.notEqual(after.steps[0].id, before.steps[0].id);
});

test("validateSteps drops hallucinated timestamps; the LLM adapter is validated end-to-end", async () => {
  const segs = [0, 1, 2].map((i) => ({ idx: i, startMs: i * 2000, endMs: i * 2000 + 1900, text: `line ${i}` }));
  const v = validateSteps({ steps: [{ title: "ok", segmentIndex: 1 }, { title: "bad index", segmentIndex: 9 }, { title: "dup", segmentIndex: 1 }, { title: "", segmentIndex: 2 }, { title: "late", segmentIndex: 2, instruction: "do it" }, { title: "backwards", segmentIndex: 0 }] }, segs, 6000);
  assert.deepEqual(v.steps.map((s) => [s.title, s.atMs]), [["ok", 2000], ["late", 4000]]);
  assert.equal(v.dropped, 4);
  assert.equal(outlineFromTranscript([], 30000, "t").steps.length >= 3, true, "no transcript -> even intervals");

  let seen: { model?: string; messages?: { content: string }[] } = {};
  const srv = http.createServer((req, res) => {
    let body = ""; req.on("data", (d) => (body += d)); req.on("end", () => {
      seen = JSON.parse(body);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: "AI title", steps: [{ title: "Real", instruction: "Do X.", segmentIndex: 1 }, { title: "Invented", segmentIndex: 42 }] }) } }] }));
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as { port: number }).port;
  Object.assign(process.env, { SOP_PROVIDER: "openai", SOP_API_KEY: "test-key", SOP_BASE_URL: `http://127.0.0.1:${port}/v1`, SOP_MODEL: "m" });
  try {
    const d = await getSopGenerator().generate(segs, 6000, "Original");
    assert.equal(d.title, "AI title");
    assert.deepEqual(d.steps.map((s) => s.atMs), [2000], "only the step that points at a real segment survives");
    assert.match(d.notes.join(" "), /1 generated step/);
    assert.ok(seen.messages?.[1].content.includes("[1] line 1"), "transcript sent with segment indexes");
  } finally {
    srv.close();
    for (const k of ["SOP_PROVIDER", "SOP_API_KEY", "SOP_BASE_URL", "SOP_MODEL"]) delete process.env[k];
  }
});
