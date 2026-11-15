import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sign } from "../src/lib/server/tokens";

export const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3200";

export function devCookie(email: string, name?: string) {
  const body = Buffer.from(JSON.stringify({ email: email.toLowerCase(), name: name || null })).toString("base64url");
  return `rg_dev=${body}.${sign(`dev:${body}`)}`;
}

export type Client = { cookie: string; fetch: (path: string, init?: RequestInit & { json?: unknown }) => Promise<Response> };

/** A cookie-carrying HTTP client. Pass no cookie for a fresh anonymous guest. */
export function client(cookie = ""): Client {
  const jar = new Map<string, string>();
  if (cookie) for (const c of cookie.split("; ")) jar.set(c.split("=")[0], c.slice(c.indexOf("=") + 1));
  return {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers);
      if (jar.size) headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
      let body = init.body;
      if (init.json !== undefined) {
        headers.set("content-type", "application/json");
        body = JSON.stringify(init.json);
      }
      const res = await fetch(path.startsWith("http") ? path : BASE + path, { ...init, headers, body, redirect: "manual" });
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        const [kv] = sc.split(";");
        jar.set(kv.split("=")[0], kv.slice(kv.indexOf("=") + 1));
      }
      return res;
    },
  };
}

/** Make a small WebM like MediaRecorder would produce (VP8 + Opus), then cut it into byte chunks. */
export function makeFixture(seconds = 6, withAudio = true) {
  const dir = mkdtempSync(join(tmpdir(), "rg-fixture-"));
  const out = join(dir, "fixture.webm");
  const args = ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=640x360:rate=25:duration=${seconds}`];
  if (withAudio) args.push("-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`);
  args.push("-c:v", "libvpx", "-b:v", "600k", ...(withAudio ? ["-c:a", "libopus"] : []), out);
  execFileSync("ffmpeg", args);
  const bytes = readFileSync(out);
  return { path: out, bytes, size: statSync(out).size };
}

export function splitChunks(bytes: Buffer, n: number): Buffer[] {
  const size = Math.ceil(bytes.length / n);
  return Array.from({ length: n }, (_, i) => bytes.subarray(i * size, Math.min(bytes.length, (i + 1) * size))).filter((b) => b.length);
}

export async function uploadChunk(c: Client, id: string, idx: number, data: Buffer) {
  const r = await c.fetch(`/api/uploads/${id}/chunks/${idx}/url`, { method: "POST" });
  if (!r.ok) throw new Error(`chunk url ${r.status}`);
  const { url, headers } = await r.json();
  const put = await fetch(url.startsWith("http") ? url : BASE + url, { method: "PUT", headers, body: new Uint8Array(data) });
  if (!put.ok) throw new Error(`chunk put ${put.status}`);
  return c.fetch(`/api/uploads/${id}/chunks/${idx}/complete`, { method: "POST", json: { size: data.length } });
}

/** A fragmented H.264/AAC MP4 like Chrome's MediaRecorder produces. Baseline profile so a stream copy is distinguishable from our High-profile transcode. */
export function makeMp4Fixture(seconds = 6) {
  const dir = mkdtempSync(join(tmpdir(), "rg-fixture-mp4-"));
  const out = join(dir, "fixture.mp4");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=640x360:rate=25:duration=${seconds}`, "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`,
    "-c:v", "libx264", "-profile:v", "baseline", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "frag_keyframe+empty_moov+default_base_moof", out]);
  const bytes = readFileSync(out);
  return { path: out, bytes, size: statSync(out).size };
}
