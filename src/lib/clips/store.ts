// Local-first clip storage: metadata + video blobs live in the browser's IndexedDB.

export type ClipComment = {
  id: string;
  /** Seconds into the clip the comment is attached to. */
  at: number;
  text: string;
  createdAt: number;
};

export type ClipMeta = {
  id: string;
  title: string;
  createdAt: number;
  /** Seconds. */
  duration: number;
  size: number;
  mimeType: string;
  thumbnail?: string;
  comments: ClipComment[];
  reactions: Record<string, number>;
};

const DB_NAME = "glimpse";
const META = "clips";
const BLOBS = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const req = fn(tx);
    tx.oncomplete = () => {
      db.close();
      resolve(req ? req.result : undefined);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function saveClip(meta: ClipMeta, blob: Blob): Promise<void> {
  await run([META, BLOBS], "readwrite", (tx) => {
    tx.objectStore(META).put(meta);
    tx.objectStore(BLOBS).put(blob, meta.id);
  });
}

export async function listClips(): Promise<ClipMeta[]> {
  const all = (await run<ClipMeta[]>([META], "readonly", (tx) => tx.objectStore(META).getAll())) ?? [];
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getClip(id: string): Promise<{ meta: ClipMeta; blob: Blob } | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META, BLOBS], "readonly");
    const m = tx.objectStore(META).get(id);
    const b = tx.objectStore(BLOBS).get(id);
    tx.oncomplete = () => {
      db.close();
      resolve(m.result && b.result ? { meta: m.result, blob: b.result } : null);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function updateClip(id: string, patch: Partial<ClipMeta>): Promise<ClipMeta | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META], "readwrite");
    const store = tx.objectStore(META);
    let next: ClipMeta | null = null;
    store.get(id).onsuccess = (e) => {
      const cur = (e.target as IDBRequest<ClipMeta | undefined>).result;
      if (!cur) return;
      next = { ...cur, ...patch, id };
      store.put(next);
    };
    tx.oncomplete = () => {
      db.close();
      resolve(next);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteClip(id: string): Promise<void> {
  await run([META, BLOBS], "readwrite", (tx) => {
    tx.objectStore(META).delete(id);
    tx.objectStore(BLOBS).delete(id);
  });
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}
