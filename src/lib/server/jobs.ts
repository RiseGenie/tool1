import type { PoolClient } from "pg";
import { one, pool } from "./db";

export type JobKind = "process" | "transcribe";
export type Job = {
  id: string;
  kind: JobKind;
  recording_id: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

/** Enqueue a job. A dedupe key prevents duplicate queued/running work (e.g. a retried finalize). */
export async function enqueue(
  kind: JobKind,
  recordingId: string,
  opts: { payload?: Record<string, unknown>; dedupeKey?: string; client?: PoolClient } = {},
) {
  const q = (opts.client ?? pool()).query.bind(opts.client ?? pool());
  await q(
    `insert into jobs(kind, recording_id, payload, dedupe_key) values ($1,$2,$3,$4)
     on conflict (dedupe_key) where dedupe_key is not null and status in ('queued','running') do nothing`,
    [kind, recordingId, opts.payload ?? {}, opts.dedupeKey ?? null],
  );
}

/** Atomically claim the next runnable job. Safe with multiple workers. */
export async function claim(): Promise<Job | null> {
  await pool().query(
    `update jobs set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
            locked_at = null, last_error = coalesce(last_error, 'worker lost (lock expired)')
      where status = 'running' and locked_at < now() - interval '15 minutes'`,
  );
  return one<Job>(
    `update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
      where id = (select id from jobs where status = 'queued' and run_at <= now()
                  order by run_at, id for update skip locked limit 1)
      returning id::text, kind, recording_id, payload, attempts, max_attempts`,
  );
}

export async function complete(id: string) {
  await pool().query(`update jobs set status='done', finished_at=now(), locked_at=null where id=$1`, [id]);
}

/** Retry with exponential backoff until max_attempts, then mark failed. Returns true if it will retry. */
export async function fail(job: Job, err: unknown): Promise<boolean> {
  const msg = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  const retry = job.attempts < job.max_attempts;
  const delaySec = Math.min(900, 5 * 2 ** (job.attempts - 1));
  await pool().query(
    `update jobs set status = $2, last_error = $3, locked_at = null,
            run_at = now() + ($4 || ' seconds')::interval, finished_at = case when $2 = 'failed' then now() end
      where id = $1`,
    [job.id, retry ? "queued" : "failed", msg, String(delaySec)],
  );
  return retry;
}
