import { claim, complete, fail } from "../src/lib/server/jobs";
import { pool, query } from "../src/lib/server/db";
import { getStorage, keys } from "../src/lib/server/storage";
import { markFailed, processJob, sopFrameJob, sopJob, transcribeJob } from "./process";

let stopping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runOnce(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;
  const t0 = Date.now();
  try {
    if (job.kind === "process") await processJob(job);
    else if (job.kind === "transcribe") await transcribeJob(job);
    else if (job.kind === "sop") await (job.payload.stepId ? sopFrameJob(job) : sopJob(job));
    else throw new Error(`Unknown job kind ${job.kind}`);
    await complete(job.id);
    console.log(`[worker] ${job.kind} ${job.recording_id} ok in ${Date.now() - t0}ms`);
  } catch (e) {
    const willRetry = await fail(job, e);
    console.error(`[worker] ${job.kind} ${job.recording_id} failed (attempt ${job.attempts}/${job.max_attempts}, ${willRetry ? "will retry" : "giving up"}):`, (e as Error).message);
    if (!willRetry) await markFailed(job, e);
  }
  return true;
}

/** Remove request submissions that were started but never finalized within 24h (and their leftover chunks). */
export async function sweepAbandoned() {
  const rows = await query<{ id: string }>(
    `delete from recordings where request_id is not null and status='uploading' and created_at < now() - interval '24 hours' returning id`,
  );
  const st = getStorage();
  for (const r of rows) for (let i = 0; i < 200; i++) await st.remove(keys.chunk(r.id, i)).catch(() => {});
  return rows.length;
}

async function loop(n: number) {
  while (!stopping) {
    try {
      if (!(await runOnce())) await sleep(1000);
    } catch (e) {
      console.error(`[worker ${n}] loop error`, e);
      await sleep(3000);
    }
  }
}

if (process.argv[1]?.endsWith("worker/index.ts") || process.argv[1]?.endsWith("worker/index.js")) {
  const concurrency = Number(process.env.WORKER_CONCURRENCY || 1);
  console.log(`[worker] started, concurrency ${concurrency}`);
  const done = Promise.all(Array.from({ length: concurrency }, (_, i) => loop(i)));
  const sweep = setInterval(() => void sweepAbandoned().catch((e) => console.error("[worker] sweep failed", e)), 10 * 60_000);
  sweep.unref();
  const stop = () => {
    stopping = true;
    done.then(() => pool().end()).then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
