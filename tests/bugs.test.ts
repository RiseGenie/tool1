// Phase 2e: bug reports — reviewable diagnostics, validated attachments, idempotent submission to a tracker.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { client, devCookie, makeFixture, splitChunks, uploadChunk } from "./helpers";
import { runOnce } from "../worker/index";
import { configuredTracker } from "../src/lib/server/bugs";

const owner = client(devCookie("bug-owner@example.com", "Bea Reporter"));
const other = client(devCookie("bug-other@example.com"));
const issues: { title: string; body: string; labels: string[]; auth?: string }[] = [];
let failNext = 0;
let srv: http.Server;
before(async () => {
  srv = http.createServer((req, res) => {
    let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
      if (req.url === "/repos/acme/app/issues" && req.method === "POST") {
        if (failNext > 0) { failNext--; res.statusCode = 500; return res.end("boom"); }
        const j = JSON.parse(b); issues.push({ ...j, auth: req.headers.authorization });
        res.setHeader("content-type", "application/json"); res.statusCode = 201;
        return res.end(JSON.stringify({ html_url: `https://github.com/acme/app/issues/${issues.length}`, number: issues.length }));
      }
      res.statusCode = 404; res.end();
    });
  });
  await new Promise<void>((r) => srv.listen(3299, "127.0.0.1", r));
});
after(() => srv.close());

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const create = async (body: object = {}) => (await (await owner.fetch("/api/bug-reports", { method: "POST", json: body })).json()).id as string;
const get = async (id: string) => (await (await owner.fetch(`/api/bug-reports/${id}`)).json()).report;
const attach = (id: string, buf: Buffer, name: string, type = "application/octet-stream") => {
  const f = new FormData(); f.set("file", new Blob([new Uint8Array(buf)], { type }), name);
  return owner.fetch(`/api/bug-reports/${id}/attachments`, { method: "POST", body: f });
};
const submit = (id: string, body: object = { confirmed: true }) => owner.fetch(`/api/bug-reports/${id}/submit`, { method: "POST", json: body });

test("drafts: fields, severity validation, ownership, and diagnostics are allow-listed", async () => {
  const id = await create();
  const r = await owner.fetch(`/api/bug-reports/${id}`, { method: "PATCH", json: {
    title: "Save button does nothing", steps: "1. Open settings\n2. Click Save", expected: "Settings saved", actual: "Nothing happens", severity: "high",
    diagnostics: { userAgent: "Chrome/200", platform: "Linux", cookies: "SECRET=abc", email: "me@x.com", viewport: "1280x800", timezone: "x".repeat(1000) },
  } });
  assert.equal(r.status, 200);
  const b = await get(id);
  assert.deepEqual(Object.keys(b.diagnostics).sort(), ["platform", "timezone", "userAgent", "viewport"], "unknown keys (cookies, email) are dropped server-side");
  assert.equal(b.diagnostics.timezone.length, 300);
  assert.equal((await owner.fetch(`/api/bug-reports/${id}`, { method: "PATCH", json: { severity: "apocalyptic" } })).status, 400);
  assert.equal((await other.fetch(`/api/bug-reports/${id}`)).status, 404);
  assert.equal((await client().fetch(`/api/bug-reports/${id}`)).status, 401);
});

test("a report can only reference the author's own recordings", async () => {
  const rid = randomUUID();
  const f = makeFixture(3);
  await owner.fetch("/api/recordings", { method: "POST", json: { id: rid, mimeType: "video/webm", title: "Repro" } });
  const ch = splitChunks(f.bytes, 1);
  await uploadChunk(owner, rid, 0, ch[0]);
  await owner.fetch(`/api/uploads/${rid}/finalize`, { method: "POST", json: { chunkCount: 1, totalBytes: f.size } });
  while (await runOnce());
  const id = await create({ recordingId: rid });
  assert.equal((await get(id)).recordingId, rid);
  assert.equal((await other.fetch("/api/bug-reports", { method: "POST", json: { recordingId: rid } })).status, 404);
  assert.equal((await other.fetch(`/api/bug-reports`, { method: "POST", json: {} })).status, 201);
});

test("attachments are validated by content, size and count", async () => {
  const id = await create();
  assert.equal((await attach(id, PNG, "shot.png", "image/png")).status, 201);
  assert.equal((await attach(id, Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100, 7)]), "shot2.png", "image/png")).status, 415, "an .exe renamed to .png is rejected");
  assert.equal((await attach(id, Buffer.from("<html><script>alert(1)</script></html>"), "page.txt", "text/plain")).status, 415, "HTML is not accepted as text");
  assert.equal((await attach(id, Buffer.from("#!/bin/sh\nrm -rf /"), "run.txt", "text/plain")).status, 415, "scripts aren't accepted");
  assert.equal((await attach(id, Buffer.alloc(11 * 1024 * 1024, 0x61), "big.txt", "text/plain")).status, 413);
  assert.equal((await attach(id, Buffer.from("2026-01-01 ERROR something failed\nstack...\n"), "app.log", "text/plain")).status, 201);
  for (let i = 0; i < 3; i++) assert.equal((await attach(id, PNG, `s${i}.png`, "image/png")).status, 201);
  assert.equal((await attach(id, PNG, "six.png", "image/png")).status, 409, "max 5 attachments");
  const b = await get(id);
  assert.equal(b.attachments.length, 5);
  assert.equal((await owner.fetch(`/api/bug-reports/${id}/attachments/${b.attachments[0].id}`, { method: "DELETE" })).status, 200);
  assert.equal((await get(id)).attachments.length, 4);
});

test("preview == payload: only reviewed, selected data is sent; submission is confirmed, authenticated and idempotent", async () => {
  const id = await create();
  await owner.fetch(`/api/bug-reports/${id}`, { method: "PATCH", json: { title: "Export fails on large files", steps: "1. Export 500 rows", expected: "CSV downloads", actual: "Spinner forever", severity: "blocker", diagnostics: { userAgent: "TestBrowser/1", viewport: "1024x768" } } });
  await attach(id, PNG, "error.png", "image/png");
  const prev = await (await owner.fetch(`/api/bug-reports/${id}/preview`)).json();
  assert.equal(prev.destination, "github");
  assert.match(prev.payload.body, /## Steps to reproduce\n1\. Export 500 rows/);
  assert.match(prev.payload.body, /\*\*Browser:\*\* TestBrowser\/1/);
  assert.ok(!/Time zone|Operating system|Language/.test(prev.payload.body), "unselected diagnostics are not in the preview");
  assert.equal(prev.payload.recordingUrl, null);

  assert.equal((await submit(id, {})).status, 400, "must confirm after reviewing");
  assert.equal((await submit(id, { confirmed: false })).status, 400);
  const empty = await create();
  assert.equal((await submit(empty)).status, 400, "title required");
  assert.equal(issues.length, 0);

  const before = issues.length;
  const [a, b] = await Promise.all([submit(id), submit(id)]);
  assert.ok([a.status, b.status].every((s) => s === 200 || s === 409), `${a.status}/${b.status}`);
  assert.equal(issues.length, before + 1, "a double click files exactly one issue");
  const sent = issues[issues.length - 1];
  assert.equal(sent.title, "Export fails on large files");
  assert.equal(sent.body, prev.payload.body, "what was sent is exactly what was previewed");
  assert.deepEqual(sent.labels, ["bug", "severity:blocker"]);
  assert.equal(sent.auth, "Bearer test-token");
  const again = await (await submit(id)).json();
  assert.equal(again.alreadySubmitted, true);
  assert.equal(issues.length, before + 1, "re-submitting never files a second issue");
  const done = await get(id);
  assert.equal(done.status, "submitted");
  assert.match(done.trackerRef, /github\.com\/acme\/app\/issues\/\d+/);
  assert.equal((await owner.fetch(`/api/bug-reports/${id}`, { method: "PATCH", json: { title: "changed" } })).status, 409);
  assert.equal((await other.fetch(`/api/bug-reports/${id}/submit`, { method: "POST", json: { confirmed: true } })).status, 404);
});

test("the recording link is opt-in, and then points at a working view-only link", async () => {
  const rid = (await (await owner.fetch("/api/recordings")).json()).items[0].id;
  const id = await create({ recordingId: rid });
  await owner.fetch(`/api/bug-reports/${id}`, { method: "PATCH", json: { title: "With recording" } });
  const n0 = issues.length;
  assert.equal((await submit(id)).status, 200);
  assert.ok(!/\/s\//.test(issues[n0].body), "no link unless the author opted in");

  const id2 = await create({ recordingId: rid });
  await owner.fetch(`/api/bug-reports/${id2}`, { method: "PATCH", json: { title: "With link", includeLink: true } });
  const prev = await (await owner.fetch(`/api/bug-reports/${id2}/preview`)).json();
  assert.match(prev.payload.recordingUrl, /will be created when you submit/);
  assert.equal((await submit(id2)).status, 200);
  const url = /(http[^\s]+\/s\/[\w-]+)/.exec(issues[issues.length - 1].body)![1];
  const meta = await client().fetch(url.replace(/.*\/s\//, "/api/share/"));
  assert.equal(meta.status, 200, "the shared link works for the engineers");
  assert.equal((await meta.json()).allowDownload, false);
});

test("tracker failure is surfaced, nothing is double-filed, and retry succeeds", async () => {
  const id = await create();
  await owner.fetch(`/api/bug-reports/${id}`, { method: "PATCH", json: { title: "Flaky tracker" } });
  const n0 = issues.length;
  failNext = 1;
  const r = await submit(id);
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, "tracker_failed");
  const f = await get(id);
  assert.equal(f.status, "failed");
  assert.match(f.trackerError, /500/);
  assert.equal(issues.length, n0);
  assert.equal((await submit(id)).status, 200);
  assert.equal(issues.length, n0 + 1);
  assert.equal((await get(id)).status, "submitted");
});

test("webhook adapter signs the payload, sets an idempotency key, and includes expiring attachment links", async () => {
  const got: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  const hook = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { got.push({ headers: req.headers, body: b }); res.end("ok"); }); });
  await new Promise<void>((r) => hook.listen(0, "127.0.0.1", r));
  const port = (hook.address() as { port: number }).port;
  const saved = { ...process.env };
  Object.assign(process.env, { BUG_TRACKER: "webhook", BUG_WEBHOOK_URL: `http://127.0.0.1:${port}/h`, BUG_WEBHOOK_SECRET: "s3cret" });
  try {
    const t = configuredTracker()!;
    assert.equal(t.name, "webhook");
    const out = await t.send({ title: "T", body: "B", severity: "low", attachments: [], recordingUrl: null, diagnostics: {} }, { reportId: "rep-1", attachmentUrls: [{ filename: "a.png", url: "https://x/y?sig=1" }] });
    assert.equal(out.ref, "webhook:rep-1");
    const sig = "sha256=" + createHmac("sha256", "s3cret").update(got[0].body).digest("hex");
    assert.equal(got[0].headers["x-rg-signature"], sig);
    assert.equal(got[0].headers["idempotency-key"], "rep-1");
    assert.equal(JSON.parse(got[0].body).attachmentUrls[0].filename, "a.png");
    delete process.env.BUG_WEBHOOK_URL;
    assert.equal(configuredTracker(), null, "misconfigured tracker is treated as not configured");
  } finally {
    for (const k of ["BUG_TRACKER", "BUG_WEBHOOK_URL", "BUG_WEBHOOK_SECRET"]) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    hook.close();
  }
});

test("deleting a report removes it and its attachment files", async () => {
  const id = await create();
  await attach(id, PNG, "x.png", "image/png");
  assert.equal((await owner.fetch(`/api/bug-reports/${id}`, { method: "DELETE" })).status, 200);
  assert.equal((await owner.fetch(`/api/bug-reports/${id}`)).status, 404);
  assert.equal((await other.fetch(`/api/bug-reports/${id}`, { method: "DELETE" })).status, 404);
});
