import { after } from "next/server";
import { runOnce } from "../../../worker/run";

/**
 * Optional in-process worker for serverless hosts (INLINE_WORKER=1). After a request that queued work, `kick()` schedules a
 * drain of the job queue that runs AFTER the response is sent, inside the same function invocation. With the fast path
 * (H.264 stream copy) a clip is playable within seconds, so a separate worker host is only needed for heavy jobs
 * (re-encodes of long WebM recordings, blur/mute renders, long transcriptions). Jobs are claimed with SKIP LOCKED, so this can run
 * alongside a dedicated worker, and a function that is killed at its time limit just leaves its job to be retried.
 */
export function kick() {
  if (process.env.INLINE_WORKER !== "1") return;
  after(async () => {
    const budget = Number(process.env.INLINE_WORKER_BUDGET_MS || 240_000);
    const t0 = Date.now();
    try {
      while (Date.now() - t0 < budget && (await runOnce()));
    } catch (e) {
      console.error("[inline-worker]", e);
    }
  });
}
