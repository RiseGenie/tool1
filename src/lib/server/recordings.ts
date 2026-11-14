import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { one, query } from "./db";
import { forbidden, notFound } from "./http";
import { getStorage } from "./storage";
import { decrypt, sha256 } from "./tokens";

export type Recording = {
  id: string;
  owner_id: string;
  folder_id: string | null;
  title: string;
  status: "recording" | "uploading" | "processing" | "ready" | "failed";
  failure_reason: string | null;
  visibility: "private" | "link";
  mime_type: string | null;
  source_key: string | null;
  playback_key: string | null;
  thumbnail_key: string | null;
  size_bytes: string | null;
  source_duration_ms: number | null;
  duration_ms: number | null;
  width: number | null;
  height: number | null;
  has_audio: boolean | null;
  trim_start_ms: number;
  trim_end_ms: number | null;
  thumbnail_at_ms: number | null;
  revision: number;
  transcript_status: string;
  transcript_error: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const MEDIA_TTL_SEC = Number(process.env.MEDIA_URL_TTL_SEC || 300);

export async function getOwned(id: string, userId: string): Promise<Recording> {
  const r = await one<Recording>(`select * from recordings where id = $1 and deleted_at is null`, [id]);
  if (!r) throw notFound();
  if (r.owner_id !== userId) throw notFound(); // don't reveal existence to non-owners
  return r;
}

export type ShareLink = {
  id: string;
  recording_id: string;
  allow_download: boolean;
  allow_comments: boolean;
  revoked_at: string | null;
  created_at: string;
  token_enc: string;
};

/**
 * The single gate for guest access. Every guest endpoint — metadata, media URL, captions, transcript,
 * comments, download — goes through this, so revoking a link (or flipping the recording to private)
 * takes effect on the very next request. Any failure is an identical 404 so tokens can't be probed.
 */
export async function resolveShare(token: string): Promise<{ link: ShareLink; rec: Recording }> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw notFound();
  const link = await one<ShareLink>(`select * from share_links where token_hash = $1`, [sha256(token)]);
  if (!link || link.revoked_at) throw notFound();
  const rec = await one<Recording>(`select * from recordings where id = $1 and deleted_at is null`, [link.recording_id]);
  if (!rec || rec.visibility !== "link") throw notFound();
  return { link, rec };
}

export const linkToken = (l: Pick<ShareLink, "token_enc">) => decrypt(l.token_enc);

/** Media is only playable once processing produced a playback file. */
export function playable(rec: Recording): boolean {
  return !!rec.playback_key && (rec.status === "ready" || (rec.status === "processing" && !!rec.playback_key));
}

export async function mediaUrls(rec: Recording, opts: { download?: boolean } = {}) {
  const s = getStorage();
  if (!rec.playback_key) throw notFound();
  const video = await s.presignGet(rec.playback_key, {
    ttlSec: MEDIA_TTL_SEC,
    contentType: "video/mp4",
    filename: opts.download ? `${rec.title.replace(/[^\w\- ]+/g, "").trim() || "recording"}.mp4` : undefined,
  });
  const poster = rec.thumbnail_key
    ? await s.presignGet(rec.thumbnail_key, { ttlSec: MEDIA_TTL_SEC, contentType: "image/jpeg" })
    : null;
  return { video, poster, expiresAt: Date.now() + MEDIA_TTL_SEC * 1000 };
}

/** First-party anonymous viewer id (per browser). Never treated as an identity. */
export async function viewerId(): Promise<string> {
  const store = await cookies();
  let id = store.get("rg_vid")?.value;
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = randomUUID();
    store.set("rg_vid", id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return id;
}

export function publicRecording(rec: Recording) {
  return {
    id: rec.id,
    title: rec.title,
    status: rec.status,
    failureReason: rec.failure_reason,
    visibility: rec.visibility,
    folderId: rec.folder_id,
    durationMs: rec.duration_ms,
    sourceDurationMs: rec.source_duration_ms,
    trimStartMs: rec.trim_start_ms,
    trimEndMs: rec.trim_end_ms,
    thumbnailAtMs: rec.thumbnail_at_ms,
    transcriptStatus: rec.transcript_status,
    viewCount: rec.view_count,
    hasAudio: rec.has_audio,
    width: rec.width,
    height: rec.height,
    sizeBytes: rec.size_bytes ? Number(rec.size_bytes) : null,
    createdAt: rec.created_at,
    updatedAt: rec.updated_at,
    revision: rec.revision,
  };
}

export async function transcriptFor(rec: Recording, q?: string) {
  const rows = await query<{ idx: number; start_ms: number; end_ms: number; text: string }>(
    `select idx, start_ms, end_ms, text from transcript_segments where recording_id = $1 order by idx`,
    [rec.id],
  );
  const { mapSegments } = await import("./timeline");
  let segs = mapSegments(rows, rec);
  if (q?.trim()) {
    const needle = q.trim().toLowerCase();
    segs = segs.filter((s) => s.text.toLowerCase().includes(needle));
  }
  return segs;
}

export function assertOwnerOrThrow(rec: Recording, userId: string) {
  if (rec.owner_id !== userId) throw forbidden();
}
