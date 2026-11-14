// Crash-recovery storage. Every MediaRecorder slice is written to IndexedDB as it is produced, before upload,
// so a reload, crash or lost connection never loses more than the last ~1s slice.
// Limits (surfaced in the UI): cleared site data, private windows and full disks can remove it; a memory fallback is used if IndexedDB fails.

export type LocalSession = {
  id: string; // = recording id on the server
  mime: string;
  title: string;
  createdAt: number;
  state: "recording" | "stopped" | "uploaded";
  durationMs: number | null;
  bytes: number;
  slices: number;
};

export interface LocalStore {
  kind: "idb" | "memory";
  createSession(s: Omit<LocalSession, "state" | "durationMs" | "bytes" | "slices">): Promise<void>;
  addSlice(id: string, seq: number, blob: Blob): Promise<void>;
  markStopped(id: string, durationMs: number | null): Promise<void>;
  listSessions(): Promise<LocalSession[]>;
  sliceSizes(id: string): Promise<number[]>;
  readSlices(id: string, from: number, to: number): Promise<Blob[]>;
  deleteSession(id: string): Promise<void>;
}

const DB = "rg-recorder";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("sessions", { keyPath: "id" });
      db.createObjectStore("slices", { keyPath: ["sessionId", "seq"] });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB blocked"));
  });
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = tx.onabort = () => rej(tx.error ?? new Error("IndexedDB transaction failed"));
  });

function idbStore(db: IDBDatabase): LocalStore {
  return {
    kind: "idb",
    async createSession(s) {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put({ ...s, state: "recording", durationMs: null, bytes: 0, slices: 0 } satisfies LocalSession);
      await done(tx);
    },
    async addSlice(id, seq, blob) {
      const tx = db.transaction(["sessions", "slices"], "readwrite");
      tx.objectStore("slices").put({ sessionId: id, seq, blob });
      const ss = tx.objectStore("sessions");
      ss.get(id).onsuccess = (e) => {
        const s = (e.target as IDBRequest<LocalSession | undefined>).result;
        if (s) ss.put({ ...s, bytes: s.bytes + blob.size, slices: Math.max(s.slices, seq + 1) });
      };
      await done(tx);
    },
    async markStopped(id, durationMs) {
      const tx = db.transaction("sessions", "readwrite");
      const ss = tx.objectStore("sessions");
      ss.get(id).onsuccess = (e) => {
        const s = (e.target as IDBRequest<LocalSession | undefined>).result;
        if (s) ss.put({ ...s, state: "stopped", durationMs });
      };
      await done(tx);
    },
    async listSessions() {
      const tx = db.transaction("sessions", "readonly");
      const req = tx.objectStore("sessions").getAll();
      await done(tx);
      return (req.result as LocalSession[]).sort((a, b) => b.createdAt - a.createdAt);
    },
    async sliceSizes(id) {
      const sizes: number[] = [];
      const tx = db.transaction("slices", "readonly");
      const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
      tx.objectStore("slices").openCursor(range).onsuccess = (e) => {
        const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          sizes.push((c.value.blob as Blob).size);
          c.continue();
        }
      };
      await done(tx);
      return sizes;
    },
    async readSlices(id, from, to) {
      const out: Blob[] = [];
      const tx = db.transaction("slices", "readonly");
      tx.objectStore("slices").openCursor(IDBKeyRange.bound([id, from], [id, to])).onsuccess = (e) => {
        const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          out.push(c.value.blob as Blob);
          c.continue();
        }
      };
      await done(tx);
      return out;
    },
    async deleteSession(id) {
      const tx = db.transaction(["sessions", "slices"], "readwrite");
      tx.objectStore("sessions").delete(id);
      tx.objectStore("slices").delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
      await done(tx);
    },
  };
}

function memoryStore(): LocalStore {
  const sessions = new Map<string, LocalSession>();
  const slices = new Map<string, Blob[]>();
  return {
    kind: "memory",
    async createSession(s) {
      sessions.set(s.id, { ...s, state: "recording", durationMs: null, bytes: 0, slices: 0 });
      slices.set(s.id, []);
    },
    async addSlice(id, seq, blob) {
      slices.get(id)![seq] = blob;
      const s = sessions.get(id)!;
      s.bytes += blob.size;
      s.slices = Math.max(s.slices, seq + 1);
    },
    async markStopped(id, durationMs) {
      const s = sessions.get(id);
      if (s) Object.assign(s, { state: "stopped", durationMs });
    },
    async listSessions() {
      return [...sessions.values()];
    },
    async sliceSizes(id) {
      return (slices.get(id) ?? []).map((b) => b.size);
    },
    async readSlices(id, from, to) {
      return (slices.get(id) ?? []).slice(from, to + 1);
    },
    async deleteSession(id) {
      sessions.delete(id);
      slices.delete(id);
    },
  };
}

/** Picks IndexedDB when it works (verified with a real write), otherwise an in-memory store. */
export async function openLocalStore(): Promise<LocalStore> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("no idb");
    const db = await openDb();
    const store = idbStore(db);
    const probe = `probe-${Date.now()}`;
    await store.createSession({ id: probe, mime: "x", title: "probe", createdAt: 0 });
    await store.deleteSession(probe);
    return store;
  } catch {
    return memoryStore();
  }
}
