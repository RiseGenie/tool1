// Shared upload logic for the owner's recorder and for token-scoped request links.
import { query, tx } from "./db";
import { env } from "./env";
import { HttpError } from "./http";
import { enqueue } from "./jobs";
import { getStorage, keys } from "./storage";

export const MAX_CHUNK_BYTES = 32 * 1024 * 1024;

export type Scope = {
  ownerId: string;
  /** When set, the upload must belong to a recording created through this request (a token can't touch anything else). */
  requestId?: string;
  /** Untrusted uploader: verify the first bytes really look like a video container. */
  sniff?: boolean;
  /** Total bytes allowed for this upload. */
  maxBytes?: number;
};

type UpRow = { status: string; chunk_count: number | null; recording_id: string };

async function load(id: string, s: Scope, client?: { query: typeof query }): Promise<UpRow> {
  const q = client?.query ?? query;
  const rows = (await q(
    `select u.status, u.chunk_count, u.recording_id from uploads u join recordings r on r.id = u.recording_id
      where u.id = $1 and u.owner_id = $2 ${s.requestId ? "and r.request_id = $3" : ""}`,
    s.requestId ? [id, s.ownerId, s.requestId] : [id, s.ownerId],
  )) as UpRow[];
  if (!rows[0]) throw new HttpError(404, "Upload not found");
  return rows[0];
}

const badIdx = (idx: number) => !Number.isInteger(idx) || idx < 0 || idx > 20000;

export async function uploadStatus(id: string, s: Scope) {
  const up = await load(id, s);
  const received = await query(`select idx, size_bytes::int as size from upload_chunks where upload_id=$1 order by idx`, [id]);
  return { status: up.status, chunkCount: up.chunk_count, received };
}

export async function chunkUrl(id: string, idx: number, s: Scope) {
  if (badIdx(idx)) throw new HttpError(400, "Bad chunk index");
  const up = await load(id, s);
  if (up.status !== "open") throw new HttpError(409, "Upload already finalized");
  return getStorage().presignPut(keys.chunk(id, idx), 900);
}

/** Recognises WebM/Matroska and MP4/MOV containers from their first bytes. */
export function looksLikeVideo(b: Buffer): boolean {
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return true;
  if (b.length >= 12) {
    const tag = b.subarray(4, 8).toString("latin1");
    return ["ftyp", "moov", "mdat", "free", "wide", "skip"].includes(tag);
  }
  return false;
}

export async function chunkComplete(id: string, idx: number, size: number, s: Scope) {
  if (badIdx(idx)) throw new HttpError(400, "Bad chunk index");
  const up = await load(id, s);
  if (up.status !== "open") throw new HttpError(409, "Upload already finalized");
  const st = getStorage();
  const key = keys.chunk(id, idx);
  const head = await st.head(key);
  if (!head) throw new HttpError(409, "Chunk is not in storage yet", "chunk_missing");
  if (head.size !== size) throw new HttpError(409, `Chunk size mismatch (stored ${head.size}, expected ${size})`, "chunk_size_mismatch");
  const reject = async (status: number, msg: string, code: string) => {
    await st.remove(key).catch(() => {});
    // An untrusted submission that sent junk is removed entirely so it can't clutter the library or use up the request's cap.
    if (s.requestId) await query(`delete from recordings where id=$1 and status='uploading'`, [up.recording_id]);
    throw new HttpError(status, msg, code);
  };
  if (head.size > MAX_CHUNK_BYTES) await reject(413, "Chunk is too large", "chunk_too_large");
  if (s.maxBytes) {
    const [{ total }] = await query<{ total: string }>(`select coalesce(sum(size_bytes),0)::text as total from upload_chunks where upload_id=$1 and idx<>$2`, [id, idx]);
    if (Number(total) + head.size > s.maxBytes) await reject(413, "This upload is larger than the allowed size", "too_large");
  }
  if (s.sniff && idx === 0 && !looksLikeVideo(await st.readRange(key, 0, 16))) await reject(415, "That file doesn’t look like a supported video (WebM or MP4).", "bad_type");
  await query(
    `insert into upload_chunks(upload_id, idx, size_bytes) values ($1,$2,$3) on conflict (upload_id, idx) do update set size_bytes = excluded.size_bytes`,
    [id, idx, size],
  );
}

/**
 * Idempotent finalize (see Phase 1 notes): the upload row is locked, so concurrent/retried calls serialize.
 */
export async function finalize(id: string, body: { chunkCount: number; totalBytes: number }, s: Scope) {
  const limit = Math.min(env.maxUploadBytes, s.maxBytes ?? Infinity);
  if (body.totalBytes > limit) throw new HttpError(413, "Recording is too large");
  return tx(async (c) => {
    const up = (await c.query(
      `select u.* from uploads u join recordings r on r.id = u.recording_id
        where u.id=$1 and u.owner_id=$2 ${s.requestId ? "and r.request_id=$3" : ""} for update of u`,
      s.requestId ? [id, s.ownerId, s.requestId] : [id, s.ownerId],
    )).rows[0];
    if (!up) throw new HttpError(404, "Upload not found");
    if (up.status === "finalized") {
      if (up.chunk_count !== body.chunkCount || Number(up.total_bytes) !== body.totalBytes)
        throw new HttpError(409, "Upload was finalized with different contents", "finalize_conflict");
      const r = (await c.query(`select status from recordings where id=$1`, [id])).rows[0];
      return { status: r.status as string, alreadyFinalized: true };
    }
    const chunks = (await c.query(`select idx, size_bytes::bigint as size from upload_chunks where upload_id=$1 order by idx`, [id])).rows;
    if (chunks.length !== body.chunkCount) throw new HttpError(409, `Expected ${body.chunkCount} chunks, server has ${chunks.length}`, "chunks_missing");
    let sum = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].idx !== i) throw new HttpError(409, `Chunk ${i} is missing`, "chunks_missing");
      sum += Number(chunks[i].size);
    }
    if (sum !== body.totalBytes) throw new HttpError(409, "Total size does not match the uploaded chunks", "size_mismatch");
    await c.query(`update uploads set status='finalized', chunk_count=$2, total_bytes=$3, finalized_at=now() where id=$1`, [id, body.chunkCount, body.totalBytes]);
    const rec = (await c.query(`update recordings set status='processing', size_bytes=$2, updated_at=now() where id=$1 returning revision`, [id, body.totalBytes])).rows[0];
    await enqueue("process", id, { dedupeKey: `process:${id}:${rec.revision}`, client: c });
    return { status: "processing", alreadyFinalized: false };
  });
}

