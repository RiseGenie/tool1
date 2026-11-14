// Server-only configuration. Credentials never reach the browser.
const isProd = process.env.NODE_ENV === "production";

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
    return process.env.FFMPEG_PATH || "ffmpeg";
  },
  get ffprobePath() {
    return process.env.FFPROBE_PATH || "ffprobe";
  },
};
