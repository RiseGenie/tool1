// Chunked, resumable, idempotent upload.
//  - The recording is cut into PARTS (~PART_BYTES each) from the locally stored slices, using a deterministic rule,
//    so a reload recomputes identical part boundaries and only uploads what the server doesn't have.
//  - Each part: signed URL -> PUT (progress) -> "complete" (server verifies size in storage). Retried with backoff.
//  - Finalize is idempotent server-side; a retry can never create a second recording.
import type { LocalStore } from "./local-store";

export const PART_BYTES = 4 * 1024 * 1024;
/** Tests can shrink parts (window.__RG_PART_BYTES) to exercise multi-part upload with short recordings. */
const partBytes = () => (globalThis as { __RG_PART_BYTES?: number }).__RG_PART_BYTES || PART_BYTES;

export type UploadState = {
  status: "idle" | "uploading" | "stalled" | "finalizing" | "done" | "error";
  uploadedBytes: number;
  totalBytes: number | null; // known once recording has stopped
  partsDone: number;
  partsTotal: number | null;
  error?: string;
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init.json !== undefined ? { "content-type": "application/json" } : undefined,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j.error || `Request failed (${res.status})`, j.code);
  }
  return res.json() as Promise<T>;
}

type Part = { idx: number; first: number; last: number; size: number };

/** Where the upload talks to. Owners use the session-authenticated API; request links use token-scoped routes. */
export type Endpoints = {
  create: string;
  createExtra?: Record<string, unknown>;
  status: (id: string) => string;
  chunkUrl: (id: string, idx: number) => string;
  chunkComplete: (id: string, idx: number) => string;
  finalize: (id: string) => string;
};
export const OWNER_ENDPOINTS: Endpoints = {
  create: "/api/recordings",
  status: (id) => `/api/uploads/${id}`,
  chunkUrl: (id, i) => `/api/uploads/${id}/chunks/${i}/url`,
  chunkComplete: (id, i) => `/api/uploads/${id}/chunks/${i}/complete`,
  finalize: (id) => `/api/uploads/${id}/finalize`,
};
export const requestEndpoints = (token: string, extra: Record<string, unknown>): Endpoints => ({
  create: `/api/r/${token}/submissions`,
  createExtra: extra,
  status: (id) => `/api/r/${token}/uploads/${id}/status`,
  chunkUrl: (id, i) => `/api/r/${token}/uploads/${id}/chunks/${i}/url`,
  chunkComplete: (id, i) => `/api/r/${token}/uploads/${id}/chunks/${i}/complete`,
  finalize: (id) => `/api/r/${token}/uploads/${id}/finalize`,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryable = (e: unknown) => !(e instanceof ApiError) || e.status >= 500 || e.status === 429 || e.code === "chunk_missing";

export class Uploader {
  state: UploadState = { status: "idle", uploadedBytes: 0, totalBytes: null, partsDone: 0, partsTotal: null };
  private parts: Part[] = [];
  private open: { first: number; size: number } | null = null; // part being filled during recording
  private lastSeq = -1;
  private received = new Map<number, number>(); // idx -> size on server
  private inflight = new Map<number, number>(); // idx -> bytes sent so far
  private queue: Part[] = [];
  private running = 0;
  private sealed = false;
  private stopped = false;
  private waiters: (() => void)[] = [];
  private wake: (() => void) | null = null;
  private onlineHandler = () => this.retryNow();

  constructor(
    private id: string,
    private store: LocalStore,
    private onChange: (s: UploadState) => void,
    private concurrency = 3,
    private ep: Endpoints = OWNER_ENDPOINTS,
  ) {
    if (typeof window !== "undefined") window.addEventListener("online", this.onlineHandler);
  }

  private emit(patch: Partial<UploadState> = {}) {
    const confirmed = [...this.received.values()].reduce((a, b) => a + b, 0);
    const live = [...this.inflight.values()].reduce((a, b) => a + b, 0);
    this.state = { ...this.state, ...patch, uploadedBytes: confirmed + live, partsDone: this.received.size };
    this.onChange(this.state);
  }

  /** Create (or re-attach to) the server-side recording. Idempotent. */
  async init(meta: { mimeType: string; title?: string }) {
    const r = await this.withRetry(() => api<{ received: { idx: number; size: number }[] }>(this.ep.create, { method: "POST", json: { id: this.id, mimeType: meta.mimeType, title: meta.title, ...this.ep.createExtra } }));
    for (const c of r.received) this.received.set(c.idx, c.size);
    this.emit();
  }

  /** Called as each slice is stored locally while recording. Seals a part once it reaches PART_BYTES. */
  notifySlice(seq: number, size: number) {
    if (this.sealed) return;
    this.lastSeq = seq;
    if (!this.open) this.open = { first: seq, size: 0 };
    this.open.size += size;
    if (this.open.size >= partBytes()) this.sealOpen();
  }

  private sealOpen() {
    if (!this.open) return;
    const part: Part = { idx: this.parts.length, first: this.open.first, last: this.lastSeq, size: this.open.size };
    this.parts.push(part);
    this.open = null;
    this.enqueue(part);
  }

  /** Recording stopped: seal the remainder, upload everything outstanding, then finalize. */
  async finish() {
    if (!this.sealed) {
      this.sealOpen();
      this.sealed = true;
    }
    await this.drainAndFinalize();
  }

  /** After a reload/crash: rebuild parts from local slices and upload whatever the server lacks. */
  async resume() {
    const sizes = await this.store.sliceSizes(this.id);
    if (!sizes.length) throw new ApiError(410, "Nothing left on this device to upload");
    this.parts = [];
    this.open = null;
    let first = 0;
    let acc = 0;
    sizes.forEach((s, i) => {
      acc += s;
      if (acc >= partBytes()) {
        this.parts.push({ idx: this.parts.length, first, last: i, size: acc });
        first = i + 1;
        acc = 0;
      }
    });
    if (acc > 0) this.parts.push({ idx: this.parts.length, first, last: sizes.length - 1, size: acc });
    this.sealed = true;
    this.state.totalBytes = sizes.reduce((a, b) => a + b, 0);
    for (const p of this.parts) if (this.received.get(p.idx) !== p.size) this.enqueue(p);
    await this.drainAndFinalize();
  }

  private enqueue(p: Part) {
    if (this.received.get(p.idx) === p.size) return;
    this.queue.push(p);
    this.emit({ status: this.state.status === "stalled" ? "stalled" : "uploading" });
    this.pump();
  }

  retryNow() {
    this.wake?.();
  }

  private pump() {
    while (this.running < this.concurrency && this.queue.length && !this.stopped) {
      const p = this.queue.shift()!;
      this.running++;
      this.uploadPart(p)
        .catch((e) => {
          this.emit({ status: "error", error: e instanceof Error ? e.message : String(e) });
          this.queue.unshift(p);
          this.stopped = true;
        })
        .finally(() => {
          this.running--;
          this.pump();
          this.checkIdle();
        });
    }
  }

  private checkIdle() {
    // Idle = nothing in flight and nothing left to do. After a fatal error we stop dispatching, so in-flight work draining is enough.
    if (this.running === 0 && (this.queue.length === 0 || this.stopped)) this.waiters.splice(0).forEach((w) => w());
  }

  private waitIdle() {
    return new Promise<void>((res) => {
      this.waiters.push(res);
      this.checkIdle();
    });
  }

  /** Retry with exponential backoff; while offline or the server is failing, report "stalled" and wait for a retry/online event. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        const out = await fn();
        if (this.state.status === "stalled") this.emit({ status: "uploading", error: undefined });
        return out;
      } catch (e) {
        if (!retryable(e)) throw e;
        attempt++;
        if (attempt >= 4) {
          this.emit({ status: "stalled", error: navigator.onLine === false ? "You’re offline. Upload will resume when you reconnect." : "Upload interrupted. Retrying…" });
        }
        const delay = Math.min(30000, 500 * 2 ** Math.min(attempt, 6)) + Math.random() * 250;
        await Promise.race([sleep(delay), new Promise<void>((r) => (this.wake = r))]);
        this.wake = null;
      }
    }
  }

  private async uploadPart(p: Part) {
    await this.withRetry(async () => {
      this.inflight.set(p.idx, 0);
      try {
        const blob = new Blob(await this.store.readSlices(this.id, p.first, p.last));
        if (blob.size !== p.size) throw new ApiError(500, "Local data does not match the expected part size");
        const { url, headers } = await api<{ url: string; headers: Record<string, string> }>(this.ep.chunkUrl(this.id, p.idx), { method: "POST" });
        await this.put(url, headers, blob, (sent) => {
          this.inflight.set(p.idx, sent);
          this.emit();
        });
        await api(this.ep.chunkComplete(this.id, p.idx), { method: "POST", json: { size: blob.size } });
        this.received.set(p.idx, blob.size);
      } finally {
        this.inflight.delete(p.idx);
      }
    });
    this.emit();
  }

  private put(url: string, headers: Record<string, string>, body: Blob, onProgress: (sent: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("PUT", url);
      for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
      x.upload.onprogress = (e) => onProgress(e.loaded);
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new ApiError(x.status, `Storage returned ${x.status}`)));
      x.onerror = () => reject(new Error("Network error during upload"));
      x.ontimeout = () => reject(new Error("Upload timed out"));
      x.send(body);
    });
  }

  private async drainAndFinalize() {
    this.stopped = false;
    this.state.partsTotal = this.parts.length;
    this.state.totalBytes = this.parts.reduce((a, p) => a + p.size, 0);
    this.emit({ status: "uploading" });
    await this.waitIdle();
    if (this.state.status === "error") throw new ApiError(500, this.state.error || "Upload failed");
    this.emit({ status: "finalizing" });
    const total = this.state.totalBytes!;
    for (let heal = 0; ; heal++) {
      try {
        await this.withRetry(() => api(this.ep.finalize(this.id), { method: "POST", json: { chunkCount: this.parts.length, totalBytes: total } }));
        break;
      } catch (e) {
        // The server is missing something we thought we sent (e.g. storage lost an object): re-sync and re-send.
        if (e instanceof ApiError && (e.code === "chunks_missing" || e.code === "size_mismatch") && heal < 3) {
          const s = await api<{ received: { idx: number; size: number }[] }>(this.ep.status(this.id));
          this.received.clear();
          s.received.forEach((c) => this.received.set(c.idx, c.size));
          for (const p of this.parts) if (this.received.get(p.idx) !== p.size) this.enqueue(p);
          await this.waitIdle();
          continue;
        }
        this.emit({ status: "error", error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    }
    await this.store.deleteSession(this.id).catch(() => {});
    this.emit({ status: "done" });
  }

  dispose() {
    if (typeof window !== "undefined") window.removeEventListener("online", this.onlineHandler);
  }
}

export async function deleteServerRecording(id: string) {
  await fetch(`/api/recordings/${id}`, { method: "DELETE" }).catch(() => {});
}
