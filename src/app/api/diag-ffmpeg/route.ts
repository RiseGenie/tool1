// TEMPORARY diagnostic (removed after use): where does the deployed function look for ffmpeg/ffprobe, and do the files exist?
import { existsSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { env } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = { vercel: !!process.env.VERCEL, cwd: process.cwd(), ffmpegPath: env.ffmpegPath, ffprobePath: env.ffprobePath };
  out.ffmpegExists = existsSync(env.ffmpegPath);
  out.ffprobeExists = existsSync(env.ffprobePath);
  for (const pkg of ["ffmpeg-static", "ffprobe-static"]) {
    try {
      const req = createRequire(join(process.cwd(), "package.json"));
      const m = req(pkg);
      const p = typeof m === "string" ? m : m.path;
      out[pkg] = { resolved: p, exists: existsSync(p), size: existsSync(p) ? statSync(p).size : null };
    } catch (e) {
      out[pkg] = { error: (e as Error).message.slice(0, 200) };
    }
    const dir = join(process.cwd(), "node_modules", pkg);
    out[`${pkg}-dir`] = existsSync(dir) ? readdirSync(dir).slice(0, 12) : "missing";
  }
  const lin = join(process.cwd(), "node_modules", "ffprobe-static", "bin");
  out["ffprobe-bin"] = existsSync(lin) ? readdirSync(lin) : "missing";
  return Response.json(out);
}
