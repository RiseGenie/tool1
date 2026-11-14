import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPoint, mapSegments, toVtt, editToSource } from "../src/lib/server/timeline";

const trim = { trim_start_ms: 2000, trim_end_ms: 8000, source_duration_ms: 10000 };
const segs = [
  { start_ms: 0, end_ms: 1500, text: "before" },
  { start_ms: 1500, end_ms: 3000, text: "straddles start" },
  { start_ms: 4000, end_ms: 6000, text: "inside" },
  { start_ms: 7500, end_ms: 9500, text: "straddles end" },
  { start_ms: 9000, end_ms: 10000, text: "after" },
];

test("transcript is clipped and shifted onto the edited timeline", () => {
  const m = mapSegments(segs, trim);
  assert.deepEqual(m.map((s) => s.text), ["straddles start", "inside", "straddles end"]);
  assert.deepEqual([m[0].start_ms, m[0].end_ms], [0, 1000]);
  assert.deepEqual([m[1].start_ms, m[1].end_ms], [2000, 4000]);
  assert.deepEqual([m[2].start_ms, m[2].end_ms], [5500, 6000]);
});

test("untrimmed recordings map to themselves", () => {
  const m = mapSegments(segs, { trim_start_ms: 0, trim_end_ms: null, source_duration_ms: 10000 });
  assert.equal(m.length, 5);
  assert.equal(m[2].start_ms, 4000);
});

test("comment anchors shift with the trim and are flagged when outside", () => {
  assert.deepEqual(mapPoint(5000, trim), { ms: 3000, outside: false });
  assert.deepEqual(mapPoint(1000, trim), { ms: 0, outside: true });
  assert.deepEqual(mapPoint(9000, trim), { ms: 6000, outside: true });
  assert.equal(editToSource(3000, trim), 5000);
});

test("WebVTT output is well-formed", () => {
  const v = toVtt([{ start_ms: 3723004, end_ms: 3725000, text: "a --> b" }]);
  assert.match(v, /^WEBVTT\n\n1\n01:02:03\.004 --> 01:02:05\.000\na → b/);
});
