"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Folder, FolderPlus, Inbox, Pencil, Search, Trash2, Video } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { StatusBadge, fmtTime } from "./StatusBadge";

type Item = {
  id: string; title: string; status: string; durationMs: number | null; viewCount: number; createdAt: string;
  thumbnailUrl: string | null; transcriptStatus: string; visibility: string; fromRequest?: boolean; submitterName?: string | null;
};
type FolderT = { id: string; name: string; count: number };

export function Library() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [folders, setFolders] = useState<FolderT[]>([]);
  const [matches, setMatches] = useState<Record<string, { startMs: number; text: string }[]>>({});
  const [folder, setFolder] = useState<string>("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    try {
      const r = await jfetch<{ items: Item[]; folders: FolderT[]; matches: typeof matches }>(`/api/recordings?folder=${folder}&q=${encodeURIComponent(q)}`);
      if (n !== seq.current) return;
      setItems(r.items);
      setFolders(r.folders);
      setMatches(r.matches);
      setErr(null);
    } catch (e) {
      if ((e as { status?: number }).status === 401) router.replace("/login");
      else setErr("Couldn’t load your library.");
    }
  }, [folder, q, router]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // Keep processing states fresh.
  const busy = items?.some((i) => ["uploading", "processing"].includes(i.status));
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [busy, load]);

  async function addFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolder.trim()) return;
    await jfetch("/api/folders", { method: "POST", json: { name: newFolder } });
    setNewFolder("");
    setAdding(false);
    void load();
  }

  const current = folders.find((f) => f.id === folder);
  const tab = (id: string, icon: React.ReactNode, label: string, count?: number) => (
    <button key={id} onClick={() => setFolder(id)} aria-current={folder === id ? "page" : undefined} className={`flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-medium hover:bg-slate-100 ${folder === id ? "bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] text-[color:var(--brand)]" : ""}`}>
      {icon}<span className="flex-1 truncate">{label}</span>{count !== undefined && <span className="text-xs text-[color:var(--rg-muted)]">{count}</span>}
    </button>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <nav aria-label="Folders" className="space-y-1">
        {tab("all", <Video className="size-4" aria-hidden />, "All recordings")}
        {tab("root", <Inbox className="size-4" aria-hidden />, "No folder")}
        {folders.map((f) => tab(f.id, <Folder className="size-4" aria-hidden />, f.name, f.count))}
        {adding ? (
          <form onSubmit={addFolder} className="flex gap-1 pt-1">
            <label className="sr-only" htmlFor="nf">Folder name</label>
            <input id="nf" autoFocus className="rg-input !min-h-9" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" maxLength={120} />
            <button className="rg-btn rg-btn-primary !min-h-9">Add</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-[color:var(--rg-muted)] hover:bg-slate-100"><FolderPlus className="size-4" aria-hidden />New folder</button>
        )}
      </nav>

      <section aria-label="Recordings">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{folder === "all" ? "All recordings" : folder === "root" ? "No folder" : current?.name ?? "Folder"}</h1>
          {current && (
            <>
              <button className="rg-btn !min-h-9" onClick={async () => { const n = prompt("Rename folder", current.name); if (n?.trim()) { await jfetch(`/api/folders/${current.id}`, { method: "PATCH", json: { name: n } }); void load(); } }}><Pencil className="size-4" aria-hidden />Rename</button>
              <button className="rg-btn rg-btn-danger !min-h-9" onClick={async () => { if (confirm("Delete this folder? Recordings inside are kept.")) { await jfetch(`/api/folders/${current.id}`, { method: "DELETE" }); setFolder("all"); } }}><Trash2 className="size-4" aria-hidden />Delete folder</button>
            </>
          )}
          <label className="relative ml-auto block w-full sm:w-72">
            <span className="sr-only">Search titles and transcripts</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input type="search" className="rg-input pl-9" placeholder="Search titles and transcripts" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>

        {err && <p role="alert" className="mt-4 text-[color:var(--rg-bad)]">{err}</p>}
        {items === null ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-200" />)}</div>
        ) : items.length === 0 ? (
          <div className="rg-card mt-6 p-10 text-center">
            <h2 className="text-lg font-bold">{q ? "No matches" : "No recordings yet"}</h2>
            <p className="mt-1 text-sm text-[color:var(--rg-muted)]">{q ? "Try a different word. Search covers titles and transcripts of your recordings." : "Record a walkthrough, share it, and collect feedback."}</p>
            {!q && <Link href="/app/record" className="rg-btn rg-btn-primary mt-4">Make your first recording</Link>}
          </div>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((it) => (
              <li key={it.id} className="rg-card overflow-hidden">
                <Link href={`/app/v/${it.id}`} className="block">
                  <div className="relative aspect-video bg-slate-900">
                    {it.thumbnailUrl ? <img src={it.thumbnailUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-slate-500"><Video className="size-8" aria-hidden /></div>}
                    {it.durationMs ? <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 font-mono text-xs text-white">{fmtTime(it.durationMs)}</span> : null}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="line-clamp-2 text-sm font-semibold">{it.title}</h2>
                      <StatusBadge status={it.status} />
                    </div>
                    <p className="mt-1 flex items-center gap-3 text-xs text-[color:var(--rg-muted)]">
                      <span>{new Date(it.createdAt).toLocaleDateString()}</span>
                      <span className="inline-flex items-center gap-1"><Eye className="size-3.5" aria-hidden />{it.viewCount}<span className="sr-only"> views</span></span>
                      {it.visibility === "link" && <span>Shared</span>}
                      {it.fromRequest && <span className="rounded-full bg-blue-50 px-2 text-blue-900">From {it.submitterName || "request"}</span>}
                    </p>
                  </div>
                </Link>
                {matches[it.id]?.length ? (
                  <ul className="border-t border-[color:var(--rg-line)] p-2 text-xs">
                    {matches[it.id].map((m, i) => (
                      <li key={i}><Link className="flex gap-2 rounded p-1 hover:bg-slate-100" href={`/app/v/${it.id}?t=${m.startMs}`}><span className="font-mono font-semibold text-[color:var(--brand)]">{fmtTime(m.startMs)}</span><span className="line-clamp-1">{m.text}</span></Link></li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
