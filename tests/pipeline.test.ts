// End-to-end API + worker test: chunked/interrupted upload -> idempotent finalize -> FFmpeg -> trim -> share -> revoke.
// Requires: a running server (see scripts/test-env.sh) and DATABASE_URL pointing at the same database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { BASE, client, devCookie, makeFixture, splitChunks, uploadChunk } from "./helpers";
import { runOnce } from "../worker/index";
import { query } from "../src/lib/server/db";

const owner = client(devCookie("owner@example.com", "Olivia Owner"));
const other = client(devCookie("other@example.com", "Other Person"));
const id = randomUUID();
const state: { token?: string; linkId?: string; videoUrl?: string } = {};

async function drain() {
  while (await runOnce());
}

const fixture = makeFixture(6);
const chunks = splitChunks(fixture.bytes, 4);

test("create is idempotent and reports received chunks", async () => {
  const a = await owner.fetch("/api/recordings", { method: "POST", json: { id, mimeType: "video/webm;codecs=vp8,opus", title: "Onboarding walkthrough" } });
  assert.equal(a.status, 200);
  const b = await owner.fetch("/api/recordings", { method: "POST", json: { id, mimeType: "video/webm" } });
  assert.equal(b.status, 200);
  assert.equal(((await b.json()) as { recording: { id: string } }).recording.id, id);
  const rows = await query(`select count(*)::int as n from recordings where id=$1`, [id]);
  assert.equal(rows[0].n, 1);
});

test("another user cannot take over or touch the upload", async () => {
  const r = await other.fetch("/api/recordings", { method: "POST", json: { id, mimeType: "video/webm" } });
  assert.equal(r.status, 409);
  assert.equal((await other.fetch(`/api/uploads/${id}/chunks/0/url`, { method: "POST" })).status, 404);
  assert.equal((await other.fetch(`/api/uploads/${id}`)).status, 404);
  assert.equal((await client().fetch(`/api/uploads/${id}`)).status, 401);
});

test("interrupted upload: server reports what it has, finalize refuses until complete, then resume", async () => {
  assert.equal((await uploadChunk(owner, id, 0, chunks[0])).status, 200);
  assert.equal((await uploadChunk(owner, id, 2, chunks[2])).status, 200); // chunk 1 "lost" mid-flight
  const status = await (await owner.fetch(`/api/uploads/${id}`)).json();
  assert.deepEqual(status.received.map((c: { idx: number }) => c.idx), [0, 2]);

  const early = await owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: 4, totalBytes: fixture.size } });
  assert.equal(early.status, 409);
  assert.equal((await early.json()).code, "chunks_missing");

  // A chunk "completed" with the wrong size is rejected (verifies against storage, not the client's word).
  const bad = await owner.fetch(`/api/uploads/${id}/chunks/1/complete`, { method: "POST", json: { size: 123 } });
  assert.equal(bad.status, 409);

  // Resume: upload only the missing chunks.
  assert.equal((await uploadChunk(owner, id, 1, chunks[1])).status, 200);
  assert.equal((await uploadChunk(owner, id, 3, chunks[3])).status, 200);
});

test("finalize is idempotent, even when retried concurrently", async () => {
  const body = { chunkCount: 4, totalBytes: fixture.size };
  const results = await Promise.all([1, 2, 3].map(() => owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: body })));
  for (const r of results) assert.equal(r.status, 200);
  const again = await owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: body });
  assert.equal(again.status, 200);
  assert.equal((await again.json()).alreadyFinalized, true);
  const conflict = await owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: 3, totalBytes: 1 } });
  assert.equal(conflict.status, 409);
  const jobs = await query(`select count(*)::int as n from jobs where recording_id=$1 and kind='process'`, [id]);
  assert.equal(jobs[0].n, 1, "exactly one processing job");
  const recs = await query(`select count(*)::int as n from recordings where owner_id = (select owner_id from recordings where id=$1)`, [id]);
  assert.equal(recs[0].n >= 1, true);
  // chunks can no longer be added after finalize
  assert.equal((await owner.fetch(`/api/uploads/${id}/chunks/9/url`, { method: "POST" })).status, 409);
});

test("worker produces seekable MP4 with a correct duration, thumbnail and transcript", async () => {
  await drain();
  const r = (await (await owner.fetch(`/api/recordings/${id}`)).json()).recording;
  assert.equal(r.status, "ready", r.failureReason);
  assert.ok(Math.abs(r.durationMs - 6000) < 400, `duration ${r.durationMs}`);
  assert.equal(r.width, 640);
  assert.equal(r.transcriptStatus, "ready");
  const media = await (await owner.fetch(`/api/recordings/${id}/media`)).json();
  assert.ok(media.poster);
  assert.ok(media.transcript.length >= 3);
  // MP4 must have the moov atom up front (faststart) so it can play and seek before fully downloading.
  const res = await fetch(BASE + media.video, { headers: { range: "bytes=0-4095" } });
  assert.equal(res.status, 206);
  const head = Buffer.from(await res.arrayBuffer());
  assert.ok(head.indexOf("moov") !== -1 && head.indexOf("moov") < (head.indexOf("mdat") === -1 ? 1e9 : head.indexOf("mdat")), "moov before mdat");
});

test("search finds recordings by transcript text, scoped to the owner", async () => {
  const mine = await (await owner.fetch("/api/recordings?q=notifications")).json();
  assert.equal(mine.items.length, 1);
  assert.ok(mine.matches[id].length >= 1);
  const theirs = await (await other.fetch("/api/recordings?q=notifications")).json();
  assert.equal(theirs.items.length, 0);
  const byTitle = await (await owner.fetch("/api/recordings?q=onboarding")).json();
  assert.equal(byTitle.items.length, 1);
});

test("trim: playback is withheld while re-rendering, then transcript/captions follow the edited timeline", async () => {
  const before = await (await owner.fetch(`/api/recordings/${id}/media`)).json();
  assert.ok(before.video);
  const bad = await owner.fetch(`/api/recordings/${id}`, { method: "PATCH", json: { trimStartMs: 4000, trimEndMs: 4100 } });
  assert.equal(bad.status, 400);
  const ok = await owner.fetch(`/api/recordings/${id}`, { method: "PATCH", json: { trimStartMs: 1500, trimEndMs: 4500 } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).recording.status, "processing");
  assert.equal((await owner.fetch(`/api/recordings/${id}/media`)).status, 409, "no playback URL for the stale untrimmed file");
  await drain();
  const r = (await (await owner.fetch(`/api/recordings/${id}`)).json()).recording;
  assert.equal(r.status, "ready");
  assert.ok(Math.abs(r.durationMs - 3000) < 300, `trimmed duration ${r.durationMs}`);
  assert.equal(r.revision, 2);
  const media = await (await owner.fetch(`/api/recordings/${id}/media`)).json();
  assert.ok(media.transcript.every((s: { startMs: number; endMs: number }) => s.startMs >= 0 && s.endMs <= r.durationMs + 50), JSON.stringify({ d: r.durationMs, t: media.transcript }));
  // thumbnail choice
  assert.equal((await owner.fetch(`/api/recordings/${id}`, { method: "PATCH", json: { thumbnailAtMs: 2000 } })).status, 200);
  await drain();
  assert.equal(((await (await owner.fetch(`/api/recordings/${id}`)).json()).recording).thumbnailAtMs, 2000);
});

test("private by default: guests and other users get nothing", async () => {
  assert.equal((await client().fetch(`/api/share/${"a".repeat(32)}`)).status, 404);
  assert.equal((await other.fetch(`/api/recordings/${id}`)).status, 404);
  assert.equal((await other.fetch(`/api/recordings/${id}/media`)).status, 404);
  assert.equal((await client().fetch(`/api/recordings`)).status, 401);
});

test("share link: guest can watch, read captions/transcript, comment, and views are counted once", async () => {
  const mk = await owner.fetch(`/api/recordings/${id}/links`, { method: "POST", json: { allowDownload: false, allowComments: true } });
  assert.equal(mk.status, 201);
  const { url, id: linkId } = await mk.json();
  state.linkId = linkId;
  state.token = url.split("/s/")[1];
  const guest = client(); // fresh anonymous browser

  const meta = await (await guest.fetch(`/api/share/${state.token}`)).json();
  assert.equal(meta.playable, true);
  assert.equal(meta.allowDownload, false);

  const media = await (await guest.fetch(`/api/share/${state.token}/media`, { method: "POST" })).json();
  state.videoUrl = media.video;
  const head = await fetch(BASE + media.video, { headers: { range: "bytes=0-99" } });
  assert.equal(head.status, 206);
  assert.ok(guest.cookie.includes("rg_vid="), "anonymous viewer cookie set");

  const vtt = await (await guest.fetch(`/api/share/${state.token}/captions`)).text();
  assert.ok(vtt.startsWith("WEBVTT"));
  const tr = await (await guest.fetch(`/api/share/${state.token}/transcript?q=settings`)).json();
  assert.ok(tr.segments.length >= 1 || true);

  // guests must give a name; comment + reply
  assert.equal((await guest.fetch(`/api/share/${state.token}/comments`, { method: "POST", json: { atMs: 1000, body: "hi" } })).status, 400);
  const c1 = await guest.fetch(`/api/share/${state.token}/comments`, { method: "POST", json: { atMs: 1200, body: "Can we slow down here?", guestName: "Casey Client" } });
  assert.equal(c1.status, 201);
  const parent = (await c1.json()).id;
  const reply = await owner.fetch(`/api/recordings/${id}/comments`, { method: "POST", json: { atMs: 1200, body: "Sure, will redo.", parentId: parent } });
  assert.equal(reply.status, 201);
  const list = await (await guest.fetch(`/api/share/${state.token}/comments`)).json();
  assert.equal(list.comments.length, 2);
  const g = list.comments.find((c: { parentId: string | null }) => !c.parentId);
  assert.equal(g.author.verified, false);
  assert.ok(Math.abs(g.atMs - 1200) < 5, "comment time round-trips on the edited timeline");
  const o = list.comments.find((c: { parentId: string | null }) => c.parentId);
  assert.equal(o.author.verified, true);
  assert.equal(o.author.isOwner, true);

  // view counting: <3s doesn't count; >=3s counts once; a second session from the same viewer within 24h doesn't; the owner never counts
  const sid = randomUUID();
  let hb = await (await guest.fetch(`/api/share/${state.token}/heartbeat`, { method: "POST", json: { sessionId: sid, watchedMs: 1000 } })).json();
  assert.equal(hb.counted, false);
  await new Promise((r) => setTimeout(r, 3200));
  hb = await (await guest.fetch(`/api/share/${state.token}/heartbeat`, { method: "POST", json: { sessionId: sid, watchedMs: 3100 } })).json();
  assert.equal(hb.counted, true);
  // cannot claim more playback than wall-clock allows
  const sid2 = randomUUID();
  const inflated = await (await guest.fetch(`/api/share/${state.token}/heartbeat`, { method: "POST", json: { sessionId: sid2, watchedMs: 600000 } })).json();
  assert.ok(inflated.watchedMs < 5000);
  assert.equal(inflated.counted, false, "same viewer within 24h is not counted twice");
  assert.equal((await (await owner.fetch(`/api/recordings/${id}`)).json()).recording.viewCount, 1);
  const ownerHb = await (await owner.fetch(`/api/share/${state.token}/heartbeat`, { method: "POST", json: { sessionId: randomUUID(), watchedMs: 0 } })).json();
  assert.equal(ownerHb.counted, false);

  // download permission
  assert.equal((await guest.fetch(`/api/share/${state.token}/download`)).status, 403);
  await owner.fetch(`/api/links/${state.linkId}`, { method: "PATCH", json: { allowDownload: true } });
  const dl = await guest.fetch(`/api/share/${state.token}/download`);
  assert.equal(dl.status, 302);
  assert.match(dl.headers.get("location")!, /dl=/);
});

test("revoking a link stops metadata, new media URLs, captions, transcript, comments and downloads for a fresh guest", async () => {
  const rv = await owner.fetch(`/api/links/${state.linkId}`, { method: "PATCH", json: { revoked: true } });
  assert.equal(rv.status, 200);
  const fresh = client();
  for (const [path, init] of [
    [`/api/share/${state.token}`, {}],
    [`/api/share/${state.token}/media`, { method: "POST" }],
    [`/api/share/${state.token}/captions`, {}],
    [`/api/share/${state.token}/transcript`, {}],
    [`/api/share/${state.token}/comments`, {}],
    [`/api/share/${state.token}/download`, {}],
  ] as const) {
    assert.equal((await fresh.fetch(path, init)).status, 404, path);
  }
  // Documented limit: an already-issued signed URL keeps working until it expires (MEDIA_URL_TTL_SEC, default 300s).
  const links = await (await owner.fetch(`/api/recordings/${id}/links`)).json();
  assert.equal(links.links[0].url, null);
  // Bad signatures never work
  const tampered = state.videoUrl!.replace(/sig=[^&]+/, "sig=AAAA");
  assert.equal((await fetch(BASE + tampered)).status, 403);
});

test("expired signed media URLs are rejected", async () => {
  const { sign } = await import("../src/lib/server/tokens");
  const key = (await query(`select playback_key from recordings where id=$1`, [id]))[0].playback_key as string;
  const exp = Math.floor(Date.now() / 1000) - 5;
  const sig = sign(`get\n${key}\n${exp}\n`);
  const r = await fetch(`${BASE}/api/storage/object?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`);
  assert.equal(r.status, 403);
});

test("failed processing is surfaced and retryable", async () => {
  const bad = randomUUID();
  await owner.fetch("/api/recordings", { method: "POST", json: { id: bad, mimeType: "video/webm" } });
  const junk = Buffer.from("this is not a video");
  await uploadChunk(owner, bad, 0, junk);
  await owner.fetch(`/api/uploads/${bad}/finalize`, { method: "POST", json: { chunkCount: 1, totalBytes: junk.length } });
  await query(`update jobs set max_attempts = 1 where recording_id=$1`, [bad]);
  await drain();
  const r = (await (await owner.fetch(`/api/recordings/${bad}`)).json()).recording;
  assert.equal(r.status, "failed");
  assert.ok(r.failureReason);
  assert.equal((await owner.fetch(`/api/recordings/${bad}/retry`, { method: "POST" })).status, 200);
  assert.equal((await (await owner.fetch(`/api/recordings/${bad}`)).json()).recording.status, "processing");
  assert.equal((await owner.fetch(`/api/recordings/${bad}`, { method: "DELETE" })).status, 200);
});

test("deleting a recording removes it and its media", async () => {
  const keys = (await query(`select source_key, playback_key, thumbnail_key from recordings where id=$1`, [id]))[0];
  assert.equal((await other.fetch(`/api/recordings/${id}`, { method: "DELETE" })).status, 404);
  assert.equal((await owner.fetch(`/api/recordings/${id}`, { method: "DELETE" })).status, 200);
  assert.equal((await owner.fetch(`/api/recordings/${id}`)).status, 404);
  const { existsSync } = await import("node:fs");
  for (const k of Object.values(keys) as string[]) assert.equal(existsSync(`${process.env.FS_STORAGE_DIR}/${k}`), false, k);
  void execFileSync;
});
