// Fast path: an H.264 recording is published with a stream copy (seconds), edits still re-encode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { client, devCookie, makeMp4Fixture, splitChunks, uploadChunk } from "./helpers";
import { runOnce } from "../worker/index";
import { query } from "../src/lib/server/db";

const owner = client(devCookie("fast-owner@example.com", "Fay Fast"));
const id = randomUUID();
const info = (path: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", path]).toString());

test("an H.264 MP4 upload is published by stream copy: no re-encode, correct duration, instant seeking", async () => {
  const f = makeMp4Fixture(6);
  await owner.fetch("/api/recordings", { method: "POST", json: { id, mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", title: "Fast" } });
  const ch = splitChunks(f.bytes, 3);
  for (let i = 0; i < ch.length; i++) assert.equal((await uploadChunk(owner, id, i, ch[i])).status, 200);
  await owner.fetch(`/api/uploads/${id}/finalize`, { method: "POST", json: { chunkCount: ch.length, totalBytes: f.size } });
  const t0 = Date.now();
  while (await runOnce());
  const ms = Date.now() - t0;
  const r = (await (await owner.fetch(`/api/recordings/${id}`)).json()).recording;
  assert.equal(r.status, "ready", r.failureReason);
  assert.ok(Math.abs(r.durationMs - 6000) < 300, `duration ${r.durationMs}`);
  const [row] = await query(`select playback_key from recordings where id=$1`, [id]);
  const p = info(`${process.env.FS_STORAGE_DIR}/${row.playback_key}`);
  const v = p.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  assert.equal(v.codec_name, "h264");
  assert.match(v.profile, /Baseline/, "video stream was copied (our transcode would produce High profile)");
  const head = Buffer.from(await (await fetch(`http://127.0.0.1:3200${(await (await owner.fetch(`/api/recordings/${id}/media`)).json()).video}`, { headers: { range: "bytes=0-8191" } })).arrayBuffer());
  assert.ok(head.indexOf("moov") !== -1 && head.indexOf("moov") < (head.indexOf("mdat") === -1 ? 1e9 : head.indexOf("mdat")), "moov atom up front");
  console.log(`# fast path processed ${r.durationMs / 1000}s of video (incl. transcript/thumbnail jobs) in ${ms} ms`);
});

test("a trim forces a real re-encode (High profile), so edits still work", async () => {
  assert.equal((await owner.fetch(`/api/recordings/${id}`, { method: "PATCH", json: { trimStartMs: 1000, trimEndMs: 4000 } })).status, 200);
  while (await runOnce());
  const [row] = await query(`select playback_key, duration_ms from recordings where id=$1`, [id]);
  const v = info(`${process.env.FS_STORAGE_DIR}/${row.playback_key}`).streams.find((s: { codec_type: string }) => s.codec_type === "video");
  assert.match(v.profile, /High/);
  assert.ok(Math.abs(row.duration_ms - 3000) < 300);
});
