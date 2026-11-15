// Loom-style publishing: watchable right after upload (stream copy), universal MP4 follows in the background.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { BASE, client, devCookie, makeFixture, splitChunks, uploadChunk } from "./helpers";
import { runOnce } from "../worker/index";
import { query } from "../src/lib/server/db";

const owner = client(devCookie("instant-owner@example.com", "Ivy Instant"));
const id = randomUUID();
const rec = async () => (await (await owner.fetch(`/api/recordings/${id}`)).json()).recording;

test("one worker step makes a WebM recording playable (stream copy), before any re-encode", async () => {
  const f = makeFixture(8);
  await owner.fetch("/api/recordings", { method: "POST", json: { id, mimeType: "video/webm;codecs=vp9,opus", title: "Instant" } });
  const ch = splitChunks(f.bytes, 3);
  for (let i = 0; i < ch.length; i++) assert.equal((await uploadChunk(owner, id, i, ch[i])).status, 200);
  await owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: ch.length, totalBytes: f.size } });

  const t0 = Date.now();
  assert.equal(await runOnce(), true); // exactly the 'process' job
  const instantMs = Date.now() - t0;
  const r = await rec();
  assert.equal(r.status, "ready", "playable after the first step");
  assert.equal(r.universal, false);
  assert.ok(Math.abs(r.durationMs - 8000) < 400, `duration ${r.durationMs}`);
  const media = await (await owner.fetch(`/api/recordings/${id}/media`)).json();
  assert.equal(media.mime, "video/webm");
  assert.equal(media.universal, false);
  const res = await fetch(BASE + media.video, { headers: { range: "bytes=0-1023" } });
  assert.equal(res.status, 206);
  assert.equal(res.headers.get("content-type"), "video/webm");
  const jobs = await query(`select kind, status from jobs where recording_id=$1 order by id`, [id]);
  assert.ok(jobs.some((j) => j.kind === "transcode" && j.status === "queued"), "background MP4 job is queued");
  console.log(`# instant stage: ${instantMs} ms for 8s of video`);
});

test("the background job swaps in a universal MP4 and removes the temporary WebM", async () => {
  const [before] = await query(`select playback_key from recordings where id=$1`, [id]);
  while (await runOnce());
  const r = await rec();
  assert.equal(r.universal, true);
  const media = await (await owner.fetch(`/api/recordings/${id}/media`)).json();
  assert.equal(media.mime, "video/mp4");
  const { existsSync } = await import("node:fs");
  assert.equal(existsSync(`${process.env.FS_STORAGE_DIR}/${before.playback_key}`), false, "temporary WebM removed");
  assert.ok(Math.abs(r.durationMs - 8000) < 400);
});

test("a trim never serves an instant file: it renders straight to MP4 and withholds playback meanwhile", async () => {
  assert.equal((await owner.fetch(`/api/recordings/${id}`, { method: "PATCH", json: { trimStartMs: 1000 } })).status, 200);
  assert.equal((await owner.fetch(`/api/recordings/${id}/media`)).status, 409);
  while (await runOnce());
  const r = await rec();
  assert.equal(r.universal, true);
  assert.equal(r.status, "ready");
});
