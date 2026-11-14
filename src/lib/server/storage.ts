import { createReadStream, createWriteStream, promises as fs } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { sign, verifySig } from "./tokens";

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,300}$/;
export function assertKey(key: string) {
  if (!KEY_RE.test(key) || key.includes("..") || key.includes("//")) throw new Error("Invalid storage key");
}

export type Signed = { url: string; headers: Record<string, string> };

export interface Storage {
  /** URL a client may PUT bytes to directly. */
  presignPut(key: string, ttlSec: number): Promise<Signed>;
  /** Short-lived URL for reading an object. */
  presignGet(key: string, opts: { ttlSec: number; filename?: string; contentType?: string }): Promise<string>;
  head(key: string): Promise<{ size: number } | null>;
  remove(key: string): Promise<void>;
  /** Server-side helpers for the worker. */
  downloadTo(key: string, path: string): Promise<void>;
  uploadFrom(path: string, key: string, contentType: string): Promise<void>;
  readStream(key: string): Promise<Readable>;
  copy(from: string, to: string): Promise<void>;
  /** Read a byte range (inclusive start, exclusive end). */
  readRange(key: string, start: number, end: number): Promise<Buffer>;
}

// ---------- filesystem driver (dev/tests) ----------
function fsDriver(): Storage & { pathFor(key: string): string } {
  const root = env.fsDir;
  const pathFor = (key: string) => {
    assertKey(key);
    const p = normalize(join(root, key));
    if (!p.startsWith(normalize(root))) throw new Error("Invalid storage key");
    return p;
  };
  const sigUrl = (op: "put" | "get", key: string, ttlSec: number, extra = "") => {
    const exp = Math.floor(Date.now() / 1000) + ttlSec;
    const payload = `${op}\n${key}\n${exp}\n${extra}`;
    const q = new URLSearchParams({ key, exp: String(exp), sig: sign(payload) });
    if (extra) q.set("dl", extra);
    return `/api/storage/object?${q}`;
  };
  return {
    pathFor,
    async presignPut(key, ttl) {
      assertKey(key);
      return { url: sigUrl("put", key, ttl), headers: {} };
    },
    async presignGet(key, { ttlSec, filename }) {
      assertKey(key);
      return sigUrl("get", key, ttlSec, filename || "");
    },
    async head(key) {
      try {
        return { size: (await fs.stat(pathFor(key))).size };
      } catch {
        return null;
      }
    },
    async remove(key) {
      await fs.rm(pathFor(key), { force: true });
    },
    async downloadTo(key, path) {
      await fs.mkdir(dirname(path), { recursive: true });
      await fs.copyFile(pathFor(key), path);
    },
    async uploadFrom(path, key) {
      const dest = pathFor(key);
      await fs.mkdir(dirname(dest), { recursive: true });
      await fs.copyFile(path, dest);
    },
    async readStream(key) {
      return createReadStream(pathFor(key));
    },
    async copy(from, to) {
      const dest = pathFor(to);
      await fs.mkdir(dirname(dest), { recursive: true });
      await fs.copyFile(pathFor(from), dest);
    },
    async readRange(key, start, end) {
      const fh = await fs.open(pathFor(key), "r");
      try {
        const buf = Buffer.alloc(end - start);
        const { bytesRead } = await fh.read(buf, 0, end - start, start);
        return buf.subarray(0, bytesRead);
      } finally {
        await fh.close();
      }
    },
  };
}

export function verifyFsUrl(op: "put" | "get", key: string, exp: string, sig: string, dl: string): boolean {
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return verifySig(`${op}\n${key}\n${exp}\n${dl}`, sig);
}

export async function writeFsObject(key: string, body: ReadableStream<Uint8Array> | null): Promise<number> {
  const s = getStorage() as ReturnType<typeof fsDriver>;
  const p = s.pathFor(key);
  await fs.mkdir(dirname(p), { recursive: true });
  const tmp = `${p}.part-${process.pid}-${Date.now()}`;
  const { Readable } = await import("node:stream");
  if (body) await pipeline(Readable.fromWeb(body as never), createWriteStream(tmp));
  else await fs.writeFile(tmp, "");
  await fs.rename(tmp, p); // atomic: a half-written chunk is never visible
  return (await fs.stat(p)).size;
}

export function fsPath(key: string): string {
  return (getStorage() as ReturnType<typeof fsDriver>).pathFor(key);
}

// ---------- S3-compatible driver ----------
function s3Driver(): Storage {
  const c = env.s3;
  const client = new S3Client({
    region: c.region,
    endpoint: c.endpoint,
    forcePathStyle: c.forcePathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  return {
    async presignPut(key, ttl) {
      assertKey(key);
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: c.bucket, Key: key }), { expiresIn: ttl });
      return { url, headers: {} };
    },
    async presignGet(key, { ttlSec, filename, contentType }) {
      assertKey(key);
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: c.bucket,
          Key: key,
          ResponseContentType: contentType,
          ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/"/g, "")}"` : undefined,
        }),
        { expiresIn: ttlSec },
      );
    },
    async head(key) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
        return { size: Number(r.ContentLength ?? 0) };
      } catch (e) {
        if ((e as { name?: string }).name === "NotFound" || (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
        throw e;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
    },
    async downloadTo(key, path) {
      await fs.mkdir(dirname(path), { recursive: true });
      const r = await client.send(new GetObjectCommand({ Bucket: c.bucket, Key: key }));
      await pipeline(r.Body as Readable, createWriteStream(path));
    },
    async uploadFrom(path, key, contentType) {
      await new Upload({
        client,
        params: { Bucket: c.bucket, Key: key, Body: createReadStream(path), ContentType: contentType },
      }).done();
    },
    async readStream(key) {
      const r = await client.send(new GetObjectCommand({ Bucket: c.bucket, Key: key }));
      return r.Body as Readable;
    },
    async copy(from, to) {
      assertKey(from);
      assertKey(to);
      await client.send(new CopyObjectCommand({ Bucket: c.bucket, Key: to, CopySource: `${c.bucket}/${from}` }));
    },
    async readRange(key, start, end) {
      const r = await client.send(new GetObjectCommand({ Bucket: c.bucket, Key: key, Range: `bytes=${start}-${end - 1}` }));
      return Buffer.from(await (r.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray());
    },
  };
}

const g = globalThis as unknown as { __rgStorage?: Storage };
export function getStorage(): Storage {
  if (!g.__rgStorage) g.__rgStorage = env.storageDriver === "s3" ? s3Driver() : fsDriver();
  return g.__rgStorage;
}

export const keys = {
  chunk: (recordingId: string, idx: number) => `uploads/${recordingId}/chunks/${String(idx).padStart(6, "0")}`,
  source: (recordingId: string, ext: string) => `recordings/${recordingId}/source.${ext}`,
  playback: (recordingId: string, revision: number) => `recordings/${recordingId}/playback-r${revision}.mp4`,
  thumb: (recordingId: string, revision: number) => `recordings/${recordingId}/thumb-r${revision}.jpg`,
};
