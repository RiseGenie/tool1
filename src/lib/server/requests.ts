import { one } from "./db";
import { HttpError, notFound } from "./http";
import { sha256 } from "./tokens";

export type VideoRequest = {
  id: string; owner_id: string; title: string; instructions: string; token_hash: string; token_enc: string; expires_at: string;
  max_submissions: number; allow_screen: boolean; allow_camera: boolean; allow_upload: boolean; folder_id: string | null; closed_at: string | null; created_at: string;
};

export const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_UPLOAD_BYTES || 500 * 1024 ** 2);
/** Uploads that started before expiry may finish within this grace window; no new submissions can start after expiry. */
export const UPLOAD_GRACE_MS = 60 * 60 * 1000;
export const ALLOWED_MIME = /^video\/(webm|mp4|quicktime|x-matroska)$/;

/** Single gate for every guest request endpoint. */
export async function resolveRequest(token: string, opts: { upload?: boolean } = {}): Promise<VideoRequest> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw notFound();
  const r = await one<VideoRequest>(`select * from video_requests where token_hash=$1`, [sha256(token)]);
  if (!r) throw notFound();
  if (r.closed_at) throw new HttpError(410, "This request is closed.", "closed");
  const grace = opts.upload ? UPLOAD_GRACE_MS : 0;
  if (new Date(r.expires_at).getTime() + grace < Date.now()) throw new HttpError(410, "This request has expired.", "expired");
  return r;
}
