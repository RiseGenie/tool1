export class HttpErr extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function jfetch<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init.json !== undefined ? { "content-type": "application/json", ...(init.headers as object) } : init.headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    credentials: "same-origin",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new HttpErr(res.status, j.error || `Request failed (${res.status})`, j.code);
  }
  return res.json() as Promise<T>;
}
