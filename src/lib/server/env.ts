// Server-only configuration. Credentials never reach the browser.
import { chmodSync, copyFileSync, existsSync, mkdirSync, accessSync, constants } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";

const isProd = process.env.NODE_ENV === "production";
const cache = new Map<string, string | null>();

/**
 * On serverless hosts there is no ffmpeg on PATH, so the app ships static binaries (ffmpeg-static / ffprobe-static).
 * Bundled files can lose their executable bit, so copy to the temp dir and chmod once. Returns null if the package is absent
 * or when a system ffmpeg is preferred (not serverless).
 */
function bundledBinary(pkg: string, pick: (m: unknown) => string): string | null {
  if (!process.env.VERCEL && process.env.USE_BUNDLED_FFMPEG !== "1") return null;
  if (cache.has(pkg)) return cache.get(pkg)!;
  let out: string | null = null;
  try {
    const req = createRequire(join(process.cwd(), "package.json"));
    const src = pick(req(pkg));
    if (src && existsSync(src)) {
      try { accessSync(src, constants.X_OK); out = src; } catch {
        const dir = join(tmpdir(), "rg-bin");
        mkdirSync(dir, { recursive: true });
        const dest = join(dir, pkg);
        if (!existsSync(dest)) { copyFileSync(src, dest); chmodSync(dest, 0o755); }
        out = dest;
      }
    }
  } catch { out = null; }
  cache.set(pkg, out);
  return out;
}

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable ${name}`);
  return v;
}

export const env = {
  get isProd() {
    return isProd;
  },
  get databaseUrl() {
    return need("DATABASE_URL");
  },
  get appSecret() {
    const v = process.env.APP_SECRET;
    if (v) return v;
    if (isProd) throw new Error("APP_SECRET is required in production");
    return "dev-only-insecure-secret";
  },
  get storageDriver(): "s3" | "fs" {
    const d = process.env.STORAGE_DRIVER || (isProd ? "s3" : "fs");
    if (d !== "s3" && d !== "fs") throw new Error("STORAGE_DRIVER must be s3 or fs");
    if (d === "fs" && isProd && process.env.ALLOW_FS_STORAGE_IN_PROD !== "1")
      throw new Error("STORAGE_DRIVER=fs is for development only (set ALLOW_FS_STORAGE_IN_PROD=1 to override)");
    return d;
  },
  get fsDir() {
    return process.env.FS_STORAGE_DIR || "/tmp/rg-storage";
  },
  get s3() {
    return {
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || "us-east-1",
      bucket: need("S3_BUCKET"),
      accessKeyId: need("S3_ACCESS_KEY_ID"),
      secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
    };
  },
  get supabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && anon ? { url, anon } : null;
  },
  /** Insecure email-only sign-in for local development and automated tests. Never enabled in production. */
  get devAuth() {
    return !isProd && process.env.DEV_AUTH !== "0";
  },
  get transcribe() {
    return {
      provider: (process.env.TRANSCRIBE_PROVIDER || "none") as "none" | "openai" | "mock",
      apiKey: process.env.TRANSCRIBE_API_KEY || "",
      baseUrl: process.env.TRANSCRIBE_BASE_URL || "https://api.openai.com/v1",
      model: process.env.TRANSCRIBE_MODEL || "whisper-1",
    };
  },
  get maxUploadBytes() {
    return Number(process.env.MAX_UPLOAD_BYTES || 4 * 1024 ** 3);
  },
  get ffmpegPath() {
    return process.env.FFMPEG_PATH || bundledBinary("ffmpeg-static", (m) => m as unknown as string) || "ffmpeg";
  },
  get ffprobePath() {
    return process.env.FFPROBE_PATH || bundledBinary("ffprobe-static", (m) => (m as { path: string }).path) || "ffprobe";
  },
};
