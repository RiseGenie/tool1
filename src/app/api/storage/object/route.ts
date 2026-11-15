// Signed object endpoint for the filesystem storage driver (development/tests only; production uses S3 presigned URLs).
import { promises as fs, createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { env } from "@/lib/server/env";
import { assertKey, fsPath, verifyFsUrl, writeFsObject } from "@/lib/server/storage";

const guard = (req: Request) => {
  if (env.storageDriver !== "fs") return { err: new Response("Not found", { status: 404 }) };
  const u = new URL(req.url);
  const key = u.searchParams.get("key") || "";
  const exp = u.searchParams.get("exp") || "";
  const sig = u.searchParams.get("sig") || "";
  const dl = u.searchParams.get("dl") || "";
  return { u, key, exp, sig, dl };
};

export async function PUT(req: Request) {
  const g = guard(req);
  if (g.err) return g.err;
  try {
    assertKey(g.key!);
  } catch {
    return new Response("Bad key", { status: 400 });
  }
  if (!verifyFsUrl("put", g.key!, g.exp!, g.sig!, "")) return new Response("Forbidden", { status: 403 });
  const size = await writeFsObject(g.key!, req.body);
  return new Response(null, { status: 200, headers: { etag: `"${size}"` } });
}

export async function GET(req: Request) {
  const g = guard(req);
  if (g.err) return g.err;
  try {
    assertKey(g.key!);
  } catch {
    return new Response("Bad key", { status: 400 });
  }
  if (!verifyFsUrl("get", g.key!, g.exp!, g.sig!, g.dl!)) return new Response("Forbidden", { status: 403 });
  const path = fsPath(g.key!);
  let size: number;
  try {
    size = (await fs.stat(path)).size;
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = g.key!.endsWith(".mp4") ? "video/mp4" : g.key!.endsWith(".webm") ? "video/webm" : g.key!.endsWith(".jpg") ? "image/jpeg" : "application/octet-stream";
  const headers: Record<string, string> = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
  };
  if (g.dl) headers["content-disposition"] = `attachment; filename="${g.dl.replace(/"/g, "")}"`;
  const range = req.headers.get("range");
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(createReadStream(path)) as ReadableStream, { status: 200, headers: { ...headers, "content-length": String(size) } });
}
