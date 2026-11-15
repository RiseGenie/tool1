import { claim, complete, fail } from "../src/lib/server/jobs";
import { markFailed, processJob, sopFrameJob, sopJob, transcodeJob, transcribeJob } from "./process";

export async function runOnce(): Promise<boolean> {
  const job = await claim();
  if (!job) return false;
  const t0 = Date.now();
  try {
    if (job.kind === "process") await processJob(job);
    else if (job.kind === "transcribe") await transcribeJob(job);
    else if (job.kind === "transcode") await transcodeJob(job);
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

