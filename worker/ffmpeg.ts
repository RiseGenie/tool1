import { spawn } from "node:child_process";
import { env } from "../src/lib/server/env";

export function run(cmd: string, args: string[], opts: { timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err = (err + d).slice(-20000)));
    const t = opts.timeoutMs ? setTimeout(() => p.kill("SIGKILL"), opts.timeoutMs) : null;
    p.on("error", reject);
    p.on("close", (code) => {
      if (t) clearTimeout(t);
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-1500)}`));
    });
  });
}

export type Probe = { width: number | null; height: number | null; hasAudio: boolean; durationMs: number | null };

export async function probe(path: string): Promise<Probe> {
  const { stdout } = await run(env.ffprobePath, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", path]);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "video");
  const a = (j.streams || []).find((s: { codec_type: string }) => s.codec_type === "audio");
  const d = Number(j.format?.duration);
  return { width: v?.width ?? null, height: v?.height ?? null, hasAudio: !!a, durationMs: Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : null };
}

/**
 * MediaRecorder output has no duration header, so ffprobe can't be trusted for the source. Stream-copy the file
 * to a null muxer and read the final timestamp ffmpeg reports (fast: no decoding).
 */
export async function measureDurationMs(path: string): Promise<number> {
  const { stderr } = await run(env.ffmpegPath, ["-nostdin", "-hide_banner", "-i", path, "-map", "0", "-c", "copy", "-f", "null", "-"]);
  const all = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
  const m = all[all.length - 1];
  if (!m) throw new Error("Could not determine recording duration");
  return Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000);
}

export type Blur = { x: number; y: number; w: number; h: number; s: number; e: number }; // fractions of the frame; seconds on the OUTPUT timeline
export type Mute = { s: number; e: number };

export async function transcodeToMp4(opts: { src: string; out: string; startMs: number; endMs: number | null; hasAudio: boolean; blurs?: Blur[]; mutes?: Mute[] }) {
  const args = ["-nostdin", "-y", "-hide_banner"];
  if (opts.startMs > 0) args.push("-ss", (opts.startMs / 1000).toFixed(3));
  args.push("-i", opts.src);
  if (opts.endMs !== null) args.push("-t", ((opts.endMs - opts.startMs) / 1000).toFixed(3));
  // fps=30 turns the recorder's variable frame rate into constant, which is what makes seeking exact.
  const base = "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2";
  const blurs = opts.blurs ?? [];
  if (blurs.length) {
    // Each blur: copy the frame, crop the region, blur it hard, overlay it back only between s and e. The blur is baked into the pixels.
    let g = `[0:v]${base}[v0]`;
    blurs.forEach((b, i) => {
      const f = (n: number) => n.toFixed(5);
      const crop = `crop=w=trunc(iw*${f(b.w)}/2)*2:h=trunc(ih*${f(b.h)}/2)*2:x=trunc(iw*${f(b.x)}/2)*2:y=trunc(ih*${f(b.y)}/2)*2`;
      g += `;[v${i}]split=2[a${i}][b${i}];[b${i}]${crop},boxblur=luma_radius=min(w\\,h)/4:luma_power=3:chroma_radius=min(cw\\,ch)/4:chroma_power=3[bl${i}];` +
        `[a${i}][bl${i}]overlay=x=trunc(main_w*${f(b.x)}/2)*2:y=trunc(main_h*${f(b.y)}/2)*2:enable='between(t,${b.s.toFixed(3)},${b.e.toFixed(3)})'[v${i + 1}]`;
    });
    args.push("-filter_complex", g, "-map", `[v${blurs.length}]`);
  } else {
    args.push("-map", "0:v:0", "-vf", base);
  }
  args.push(...(opts.hasAudio ? ["-map", "0:a:0"] : ["-an"]));
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1");
  if (opts.hasAudio) {
    const mute = (opts.mutes ?? []).map((m) => `volume=enable='between(t,${m.s.toFixed(3)},${m.e.toFixed(3)})':volume=0`);
    args.push("-c:a", "aac", "-b:a", "128k", "-af", [...mute, "aresample=async=1:first_pts=0"].join(","));
  }
  args.push("-movflags", "+faststart", opts.out); // moov atom first: the file can start playing and seek before it has fully downloaded
  await run(env.ffmpegPath, args, { timeoutMs: 60 * 60 * 1000 });
}

export async function extractThumbnail(src: string, out: string, atMs: number) {
  await run(env.ffmpegPath, ["-nostdin", "-y", "-hide_banner", "-ss", (atMs / 1000).toFixed(3), "-i", src, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", out]);
}

/** Mono 16 kHz speech audio, split into 10-minute pieces so each stays well below provider upload limits. */
export async function extractAudioPieces(src: string, outDir: string): Promise<string[]> {
  const { readdirSync } = await import("node:fs");
  await run(env.ffmpegPath, [
    "-nostdin", "-y", "-hide_banner", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k",
    "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1", `${outDir}/piece-%03d.mp3`,
  ]);
  return readdirSync(outDir).filter((f) => f.startsWith("piece-")).sort().map((f) => `${outDir}/${f}`);
}
