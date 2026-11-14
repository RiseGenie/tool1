// Phase 2d: expiring video-request links for guests (no account): routing, limits, type/size checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BASE, client, devCookie, makeFixture, splitChunks } from "./helpers";
import { runOnce, sweepAbandoned } from "../worker/index";
import { query } from "../src/lib/server/db";

const owner = client(devCookie("req-owner@example.com", "Rita Requester"));
const other = client(devCookie("req-other@example.com"));
const guest = (ip = "198.51.100.7") => {
  const c = client();
  const f = c.fetch.bind(c);
  c.fetch = (p, init = {}) => f(p, { ...init, headers: { ...(init.headers as object), "x-forwarded-for": ip } });
  return c;
};
const drain = async () => { while (await runOnce()); };
const S: { token?: string; rid?: string; folder?: string } = {};

async function guestUpload(g: ReturnType<typeof guest>, token: string, id: string, bytes: Buffer, parts = 2) {
  const chunks = splitChunks(bytes, parts);
  const out: { status: number; body?: { code?: string } }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const u = await g.fetch(`/api/r/${token}/uploads/${id}/chunks/${i}/url`, { method: "POST" });
    if (!u.ok) return { fail: u.status, code: (await u.json()).code, chunks };
    const { url } = await u.json();
    await fetch(BASE + url, { method: "PUT", body: new Uint8Array(chunks[i]) });
    const c = await g.fetch(`/api/r/${token}/uploads/${id}/chunks/${i}/complete`, { method: "POST", json: { size: chunks[i].length } });
    out.push({ status: c.status, body: c.ok ? undefined : await c.json() });
    if (!c.ok) return { fail: c.status, code: out[out.length - 1].body?.code, chunks };
  }
  return { chunks, fail: 0, code: undefined };
}

test("owner creates a request routed to a folder; the guest sees only what they need", async () => {
  const f = await (await owner.fetch("/api/folders", { method: "POST", json: { name: "Client replies" } })).json();
  S.folder = f.folder.id;
  const r = await owner.fetch("/api/requests", { method: "POST", json: { title: "Show us the bug", instructions: "Record what happens when you click Save.", expiresInDays: 7, maxSubmissions: 2, folderId: S.folder, allowScreen: true, allowCamera: true, allowUpload: true } });
  assert.equal(r.status, 201);
  const { request } = await r.json();
  S.rid = request.id;
  S.token = request.url.split("/r/")[1];
  assert.equal(request.status, "active");
  const meta = await (await guest().fetch(`/api/r/${S.token}`)).json();
  assert.deepEqual(Object.keys(meta).sort(), ["allowCamera", "allowScreen", "allowUpload", "expiresAt", "instructions", "maxBytes", "remaining", "title"]);
  assert.equal(meta.remaining, 2);
  assert.equal((await guest().fetch(`/api/r/${"x".repeat(30)}`)).status, 404);
  assert.equal((await client().fetch("/api/requests")).status, 401);
});

test("validation: name required, bad types and oversized files rejected before anything is stored", async () => {
  const g = guest();
  const base = { id: randomUUID(), kind: "upload", mimeType: "video/webm", name: "Gus Guest" };
  assert.equal((await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { ...base, name: "" } })).status, 400);
  assert.equal((await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { ...base, mimeType: "application/pdf" } })).status, 400);
  assert.equal((await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { ...base, mimeType: "text/html" } })).status, 400);
  const big = await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { ...base, declaredSize: 10 * 1024 ** 3 } });
  assert.equal(big.status, 413);
  assert.equal((await query(`select count(*)::int as n from recordings where request_id=$1`, [S.rid]))[0].n, 0);
});

test("a file that isn't really a video is rejected by content, not just by its label", async () => {
  const g = guest();
  const id = randomUUID();
  assert.equal((await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { id, kind: "upload", mimeType: "video/mp4", name: "Mallory" } })).status, 200);
  const res = await guestUpload(g, S.token!, id, Buffer.from("<html><script>alert(1)</script></html> not a video at all"), 1);
  assert.equal(res.fail, 415);
  assert.equal(res.code, "bad_type");
  assert.equal((await g.fetch(`/api/r/${S.token}/uploads/${id}/status`)).status, 404, "the junk submission was removed entirely");
  assert.equal((await query(`select count(*)::int as n from recordings where id=$1`, [id]))[0].n, 0);
});

test("a real upload is routed to the owner's folder, tagged with the request and submitter, and processed", async () => {
  const g = guest("203.0.113.20");
  const id = randomUUID();
  const f = makeFixture(4);
  const mk = await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { id, kind: "upload", mimeType: "video/webm", name: "Gus Guest", email: "gus@client.com", declaredSize: f.size } });
  assert.equal(mk.status, 200);
  assert.equal((await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { id, kind: "upload", mimeType: "video/webm", name: "Gus Guest" } })).status, 200, "idempotent");
  const up = await guestUpload(g, S.token!, id, f.bytes);
  assert.equal(up.fail, 0);
  const fin = await g.fetch(`/api/r/${S.token}/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: up.chunks.length, totalBytes: f.size } });
  assert.equal(fin.status, 200);
  assert.equal((await g.fetch(`/api/r/${S.token}/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: up.chunks.length, totalBytes: f.size } })).status, 200);
  await drain();
  const subs = (await (await owner.fetch(`/api/requests/${S.rid}/submissions`)).json()).submissions;
  assert.equal(subs.length, 1);
  assert.equal(subs[0].name, "Gus Guest");
  assert.equal(subs[0].kind, "upload");
  assert.equal(subs[0].status, "ready");
  const rec = (await query(`select owner_id, folder_id, request_id from recordings where id=$1`, [id]))[0];
  assert.equal(rec.folder_id, S.folder);
  assert.equal(rec.request_id, S.rid);
  const lib = await (await owner.fetch(`/api/recordings?folder=${S.folder}`)).json();
  assert.equal(lib.items.length, 1, "appears in the owner's library, in the chosen folder");
  assert.equal((await other.fetch(`/api/requests/${S.rid}/submissions`)).status, 404, "other users can't read submissions");
  assert.equal((await other.fetch(`/api/recordings/${id}`)).status, 404);
  assert.equal((await g.fetch(`/api/recordings/${id}`)).status, 401, "the guest can't read the recording back");
});

test("a token can't touch uploads that don't belong to its request", async () => {
  const r2 = await (await owner.fetch("/api/requests", { method: "POST", json: { title: "Another", maxSubmissions: 5 } })).json();
  const t2 = r2.request.url.split("/r/")[1];
  const mine = randomUUID();
  await owner.fetch("/api/recordings", { method: "POST", json: { id: mine, mimeType: "video/webm" } });
  const g = guest();
  assert.equal((await g.fetch(`/api/r/${t2}/uploads/${mine}/chunks/0/url`, { method: "POST" })).status, 404, "owner's own recording");
  const id = randomUUID();
  await g.fetch(`/api/r/${S.token}/submissions`, { method: "POST", json: { id, kind: "screen", mimeType: "video/webm", name: "Z" } });
  assert.equal((await g.fetch(`/api/r/${t2}/uploads/${id}/chunks/0/url`, { method: "POST" })).status, 404, "another request's submission");
  assert.equal((await g.fetch(`/api/r/${t2}/submissions`, { method: "POST", json: { id, kind: "screen", mimeType: "video/webm", name: "Z" } })).status, 409, "id belongs to a different request");
  await owner.fetch(`/api/recordings/${mine}`, { method: "DELETE" });
});

test("submission cap, per-IP rate limit, expiry (with upload grace) and closing", async () => {
  // cap: a request with max 1 accepts exactly one response
  const cap = await (await owner.fetch("/api/requests", { method: "POST", json: { title: "One only", maxSubmissions: 1 } })).json();
  const tc = cap.request.url.split("/r/")[1];
  const g = guest("192.0.2.50");
  assert.equal((await g.fetch(`/api/r/${tc}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: "A" } })).status, 200);
  const full = await g.fetch(`/api/r/${tc}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: "B" } });
  assert.equal(full.status, 409);
  assert.equal((await full.json()).code, "full");
  const listed = (await (await owner.fetch("/api/requests")).json()).requests.find((r: { id: string }) => r.id === cap.request.id);
  assert.equal(listed.status, "full");
  // concurrent submissions can't exceed the cap
  const cap2 = await (await owner.fetch("/api/requests", { method: "POST", json: { title: "Race", maxSubmissions: 3 } })).json();
  const t2 = cap2.request.url.split("/r/")[1];
  const racers = await Promise.all(Array.from({ length: 8 }, (_, i) => guest(`192.0.2.${100 + i}`).fetch(`/api/r/${t2}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: `R${i}` } })));
  assert.equal(racers.filter((r) => r.status === 200).length, 3);

  // per-IP limit
  const ip = "198.18.0.9";
  const r3 = await (await owner.fetch("/api/requests", { method: "POST", json: { title: "Busy", maxSubmissions: 100 } })).json();
  const t3 = r3.request.url.split("/r/")[1];
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) codes.push((await guest(ip).fetch(`/api/r/${t3}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: "Bot" } })).status);
  assert.equal(codes.filter((c) => c === 200).length, 10);
  assert.equal(codes.filter((c) => c === 429).length, 2);

  // expiry: new submissions stop at once; an upload that already started can finish within the grace window
  const startedId = randomUUID();
  assert.equal((await guest("192.0.2.77").fetch(`/api/r/${t3}/submissions`, { method: "POST", json: { id: startedId, kind: "screen", mimeType: "video/webm", name: "Late" } })).status, 200);
  await query(`update video_requests set expires_at = now() - interval '5 minutes' where id=$1`, [r3.request.id]);
  const exp = await guest("192.0.2.78").fetch(`/api/r/${t3}`);
  assert.equal(exp.status, 410);
  assert.equal((await exp.json()).code, "expired");
  assert.equal((await guest("192.0.2.79").fetch(`/api/r/${t3}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: "New" } })).status, 410);
  assert.equal((await guest().fetch(`/api/r/${t3}/uploads/${startedId}/chunks/0/url`, { method: "POST" })).status, 200, "in-flight upload may finish (grace)");
  await query(`update video_requests set expires_at = now() - interval '2 hours' where id=$1`, [r3.request.id]);
  assert.equal((await guest().fetch(`/api/r/${t3}/uploads/${startedId}/chunks/0/url`, { method: "POST" })).status, 410, "grace is over");

  // extend, then close
  assert.equal((await owner.fetch(`/api/requests/${r3.request.id}`, { method: "PATCH", json: { extendDays: 3 } })).status, 200);
  assert.equal((await guest().fetch(`/api/r/${t3}`)).status, 200);
  assert.equal((await owner.fetch(`/api/requests/${r3.request.id}`, { method: "PATCH", json: { closed: true } })).status, 200);
  const closed = await guest().fetch(`/api/r/${t3}`);
  assert.equal(closed.status, 410);
  assert.equal((await closed.json()).code, "closed");
  assert.equal((await other.fetch(`/api/requests/${r3.request.id}`, { method: "PATCH", json: { closed: false } })).status, 404);
});

test("abandoned submissions stop counting after an hour and are swept after a day", async () => {
  const r = await (await owner.fetch("/api/requests", { method: "POST", json: { title: "Sweep", maxSubmissions: 1 } })).json();
  const t = r.request.url.split("/r/")[1];
  const id = randomUUID();
  assert.equal((await guest("192.0.2.200").fetch(`/api/r/${t}/submissions`, { method: "POST", json: { id, kind: "screen", mimeType: "video/webm", name: "Walked away" } })).status, 200);
  assert.equal((await guest("192.0.2.201").fetch(`/api/r/${t}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: "Blocked" } })).status, 409, "in-flight upload holds the slot");
  await query(`update recordings set created_at = now() - interval '2 hours' where id=$1`, [id]);
  assert.equal((await guest("192.0.2.202").fetch(`/api/r/${t}/submissions`, { method: "POST", json: { id: randomUUID(), kind: "screen", mimeType: "video/webm", name: "Gets in" } })).status, 200, "stale one no longer holds the slot");
  await query(`update recordings set created_at = now() - interval '25 hours' where id=$1`, [id]);
  assert.ok((await sweepAbandoned()) >= 1);
  assert.equal((await query(`select count(*)::int as n from recordings where id=$1`, [id]))[0].n, 0);
});
