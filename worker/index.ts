import { claim, complete, fail } from "../src/lib/server/jobs";
import { pool } from "../src/lib/server/db";
import { markFailed, processJob, transcribeJob } from "./process";

let stopping = false;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runOnce(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;
  const t0 = Date.now();
  try {
    if (job.kind === "process") await processJob(job);
    else if (job.kind === "transcribe") await transcribeJob(job);
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
  const stop = () => {
    stopping = true;
    done.then(() => pool().end()).then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
