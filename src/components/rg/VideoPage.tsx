"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Copy, Eye, Image as ImageIcon, Scissors, Trash2 } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { Player, type Media, type PlayerHandle } from "./Player";
import { Transcript, type Segment } from "./Transcript";
import { Comments, type CommentT } from "./Comments";
import { StatusBadge, fmtBytes, fmtTime } from "./StatusBadge";
import { VersionsPanel } from "./VersionsPanel";
import { BlurPreview, PrivacyPanel, type RawSeg, type Redactions } from "./PrivacyPanel";

type Rec = {
  id: string; title: string; status: string; failureReason: string | null; visibility: "private" | "link"; folderId: string | null;
  durationMs: number | null; sourceDurationMs: number | null; trimStartMs: number; trimEndMs: number | null; thumbnailAtMs: number | null;
  transcriptStatus: string; viewCount: number; sizeBytes: number | null; createdAt: string; revision: number;
  versionNo: number; isDraft: boolean; locked: boolean; versionLabel: string | null; redactions: Redactions;
};
type Link_ = { id: string; allowDownload: boolean; allowComments: boolean; createdAt: string; revokedAt: string | null; url: string | null };

export function VideoPage({ id }: { id: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [rec, setRec] = useState<Rec | null>(null);
  const [links, setLinks] = useState<Link_[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [rawSegs, setRawSegs] = useState<RawSeg[]>([]);
  const [comments, setComments] = useState<CommentT[]>([]);
  const [title, setTitle] = useState("");
  const [ms, setMs] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const player = useRef<PlayerHandle>(null);
  const [tab, setTab] = useState<"transcript" | "comments">("comments");
  const initialSeek = useRef(Number(sp.get("t")) || 0);

  const load = useCallback(async () => {
    try {
      const r = await jfetch<{ recording: Rec }>(`/api/recordings/${id}`);
      setRec(r.recording);
      setTitle((t) => t || r.recording.title);
      const [l, c] = await Promise.all([jfetch<{ links: Link_[] }>(`/api/recordings/${id}/links`), jfetch<{ comments: CommentT[] }>(`/api/recordings/${id}/comments`)]);
      setLinks(l.links);
      setComments(c.comments);
    } catch (e) {
      const s = (e as { status?: number }).status;
      if (s === 401) router.replace("/login");
      else if (s === 404) setMissing(true);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
    jfetch<{ folders: { id: string; name: string }[] }>("/api/folders").then((r) => setFolders(r.folders)).catch(() => {});
  }, [load]);

  const working = rec && (["uploading", "processing"].includes(rec.status) || ["queued", "processing"].includes(rec.transcriptStatus));
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void load(), 2500);
    return () => clearInterval(t);
  }, [working, load]);

  const getMedia = useCallback(async (): Promise<Media> => {
    const r = await jfetch<Media & { transcript: Segment[]; transcriptRaw: RawSeg[] }>(`/api/recordings/${id}/media`);
    setSegments(r.transcript);
    setRawSegs(r.transcriptRaw);
    return r;
  }, [id]);

  const playable = !!rec && rec.status === "ready";

  useEffect(() => {
    if (playable && initialSeek.current) {
      const t = setTimeout(() => { player.current?.seek(initialSeek.current); initialSeek.current = 0; }, 800);
      return () => clearTimeout(t);
    }
  }, [playable]);

  async function patch(body: object, ok?: string) {
    setMsg(null);
    try {
      const r = await jfetch<{ recording: Rec }>(`/api/recordings/${id}`, { method: "PATCH", json: body });
      setRec(r.recording);
      if (ok) setMsg(ok);
      void load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  if (missing) return <div className="rg-card mx-auto max-w-md p-8 text-center"><h1 className="text-xl font-bold">Recording not found</h1><Link href="/app" className="rg-btn mt-4">Back to library</Link></div>;
  if (!rec) return <div className="h-96 animate-pulse rounded-2xl bg-slate-200" aria-busy="true" />;

  const activeLinks = links.filter((l) => !l.revokedAt);

  return (
    <div>
      <Link href="/app" className="mb-3 inline-flex min-h-9 items-center gap-1 text-sm font-medium text-[color:var(--rg-muted)] hover:text-[color:var(--rg-ink)]"><ArrowLeft className="size-4" aria-hidden />Library</Link>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-4">
          {playable ? (
            <div className="relative">
            <Player
              key={rec.revision}
              ref={player}
              getMedia={getMedia}
              captionsUrl={rec.transcriptStatus === "ready" ? `/api/recordings/${id}/captions` : null}
              onTime={setMs}
            />
            <BlurPreview blurs={rec.redactions.blurs} sourceMs={ms + rec.trimStartMs} />
            </div>
          ) : (
            <div className="grid aspect-video place-items-center rounded-2xl bg-[#14142b] p-6 text-center text-white" role="status">
              <div>
                <StatusBadge status={rec.status} />
                <p className="mt-3 text-lg font-semibold">
                  {rec.status === "failed" ? "Processing failed" : rec.status === "processing" ? "Processing your video…" : rec.status === "uploading" ? "Waiting for the upload to finish…" : "Preparing…"}
                </p>
                {rec.status === "failed" && (
                  <>
                    <p className="mt-1 max-w-md text-sm text-white/70">{rec.failureReason}</p>
                    <button className="rg-btn mt-4" onClick={async () => { await jfetch(`/api/recordings/${id}/retry`, { method: "POST" }); void load(); }}>Retry processing</button>
                  </>
                )}
                {rec.status !== "failed" && <p className="mt-1 text-sm text-white/70">This page updates automatically.</p>}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Title</span>
              <input
                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-bold hover:border-[color:var(--rg-line)] focus:border-[color:var(--brand)] focus:bg-white"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== rec.title && void patch({ title: title.trim() }, "Title saved")}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                maxLength={200}
              />
            </label>
            {rec.versionNo > 1 || rec.isDraft ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">v{rec.versionNo}{rec.isDraft ? " · Draft" : ""}</span> : null}
            <StatusBadge status={rec.status} />
          </div>
          <p className="flex flex-wrap gap-x-4 px-2 text-sm text-[color:var(--rg-muted)]">
            <span>{new Date(rec.createdAt).toLocaleString()}</span>
            {rec.durationMs ? <span>{fmtTime(rec.durationMs)}</span> : null}
            {rec.sizeBytes ? <span>{fmtBytes(rec.sizeBytes)} uploaded</span> : null}
            <span className="inline-flex items-center gap-1"><Eye className="size-4" aria-hidden />{rec.viewCount} {rec.viewCount === 1 ? "view" : "views"}</span>
          </p>
          <p role="status" aria-live="polite" className="px-2 text-sm text-[color:var(--rg-ok)]">{msg}</p>

          <div className="rg-card p-4">
            <div role="tablist" aria-label="Transcript and comments" className="mb-3 flex gap-1">
              {(["comments", "transcript"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-10 rounded-lg px-4 text-sm font-semibold capitalize ${tab === t ? "bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] text-[color:var(--brand)]" : "hover:bg-slate-100"}`}>
                  {t}{t === "comments" ? ` (${comments.length})` : ""}
                </button>
              ))}
            </div>
            {tab === "transcript" ? (
              <Transcript segments={segments} status={rec.transcriptStatus} currentMs={ms} onSeek={(t) => player.current?.seek(t)} />
            ) : (
              <Comments
                comments={comments}
                allowed
                signedIn
                currentMs={() => player.current?.currentMs() ?? 0}
                onSeek={(t) => { player.current?.seek(t); player.current?.play(); }}
                onSubmit={async (c) => { await jfetch(`/api/recordings/${id}/comments`, { method: "POST", json: c }); await load(); }}
                onDelete={async (cid) => { await jfetch(`/api/recordings/${id}/comments/${cid}`, { method: "DELETE" }); await load(); }}
                onResolve={async (cid, resolved) => { await jfetch(`/api/recordings/${id}/comments/${cid}`, { method: "PATCH", json: { resolved } }); await load(); }}
              />
            )}
            {rec.transcriptStatus === "failed" && <button className="rg-btn mt-3" onClick={async () => { await jfetch(`/api/recordings/${id}/retry`, { method: "POST" }); void load(); }}>Retry transcript</button>}
          </div>
        </div>

        <aside className="space-y-4">
          <VersionsPanel id={id} ready={rec.status === "ready"} isDraft={rec.isDraft} locked={rec.locked} onChange={load} />
          {rec.isDraft ? <div className="rg-card p-4 text-sm"><h2 className="font-semibold">Share</h2><p className="mt-1 text-[color:var(--rg-muted)]">Publish this draft to share it. Links use the current published version.</p></div> : <SharePanel rec={rec} links={links} activeCount={activeLinks.length} reload={load} patch={patch} />}
          <PrivacyPanel key={rec.revision + String(rec.locked)} value={rec.redactions} rawSegments={rawSegs} playheadSourceMs={ms + rec.trimStartMs} sourceDurationMs={rec.sourceDurationMs ?? 0} disabled={rec.status !== "ready" || rec.locked} onSave={async (r) => patch({ redactions: r }, "Privacy edits saved. Rendering sanitized version…")} />
          <TrimPanel rec={rec} playheadMs={ms} patch={patch} />
          <div className="rg-card space-y-3 p-4">
            <h2 className="font-semibold">Details</h2>
            <label className="block text-sm font-semibold" htmlFor="folder">Folder</label>
            <select id="folder" className="rg-input" value={rec.folderId ?? ""} onChange={(e) => void patch({ folderId: e.target.value || null }, "Moved")}>
              <option value="">No folder</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button className="rg-btn rg-btn-danger" onClick={async () => { if (confirm("Delete this recording and its transcript, comments and links permanently?")) { await jfetch(`/api/recordings/${id}`, { method: "DELETE" }); router.push("/app"); } }}><Trash2 className="size-4" aria-hidden />Delete recording</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SharePanel({ rec, links, activeCount, reload, patch }: { rec: Rec; links: Link_[]; activeCount: number; reload: () => Promise<void>; patch: (b: object, ok?: string) => Promise<void> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState<"private" | "link" | null>(null);
  const access = pending ?? rec.visibility;
  const isLink = access === "link";

  async function setAccess(v: "private" | "link") {
    setPending(v); // instant feedback; the server result below is the source of truth
    try {
      if (v === "link" && activeCount === 0) await jfetch(`/api/recordings/${rec.id}/links`, { method: "POST", json: { allowDownload: false, allowComments: true } });
      else await patch({ visibility: v });
      await reload();
    } finally {
      setPending(null);
    }
  }
  async function copy(l: Link_) {
    if (!l.url) return;
    await navigator.clipboard.writeText(l.url);
    setCopied(l.id);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="rg-card space-y-4 p-4">
      <h2 className="font-semibold">Share</h2>
      <fieldset>
        <legend className="text-sm font-semibold">Who can watch</legend>
        <div className="mt-2 space-y-1">
          {([["private", "Private", "Only you, when signed in"], ["link", "Anyone with the link", "No account needed"]] as const).map(([v, t, h]) => (
            <label key={v} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
              <input type="radio" name="access" className="mt-1 size-4" checked={access === v} onChange={() => void setAccess(v)} />
              <span><span className="block text-sm font-semibold">{t}</span><span className="text-xs text-[color:var(--rg-muted)]">{h}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {isLink && (
        <ul className="space-y-3" aria-label="Share links">
          {links.filter((l) => !l.revokedAt).map((l) => (
            <li key={l.id} className="rounded-xl border border-[color:var(--rg-line)] p-3">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor={`url-${l.id}`}>Share link</label>
                <input id={`url-${l.id}`} readOnly value={l.url ?? ""} className="rg-input font-mono !text-xs" onFocus={(e) => e.currentTarget.select()} />
                <button className="rg-btn" onClick={() => void copy(l)} aria-label="Copy link">{copied === l.id ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{copied === l.id ? "Copied" : "Copy"}</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4">
                <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={l.allowComments} onChange={async (e) => { await jfetch(`/api/links/${l.id}`, { method: "PATCH", json: { allowComments: e.target.checked } }); await reload(); }} />Allow comments</label>
                <label className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={l.allowDownload} onChange={async (e) => { await jfetch(`/api/links/${l.id}`, { method: "PATCH", json: { allowDownload: e.target.checked } }); await reload(); }} />Allow download</label>
              </div>
              <button className="rg-btn rg-btn-danger mt-2 !min-h-9" onClick={async () => { if (confirm("Revoke this link? Anyone using it loses access immediately and the link can’t be restored.")) { await jfetch(`/api/links/${l.id}`, { method: "PATCH", json: { revoked: true } }); await reload(); } }}>Revoke link</button>
            </li>
          ))}
          {activeCount === 0 && <li className="text-sm text-[color:var(--rg-muted)]">All links were revoked. Create a new one to share again.</li>}
        </ul>
      )}
      {isLink && <button className="rg-btn" onClick={async () => { await jfetch(`/api/recordings/${rec.id}/links`, { method: "POST", json: {} }); await reload(); }}>Create another link</button>}
    </div>
  );
}

function TrimPanel({ rec, playheadMs, patch }: { rec: Rec; playheadMs: number; patch: (b: object, ok?: string) => Promise<void> }) {
  const src = rec.sourceDurationMs ?? 0;
  const [start, setStart] = useState(rec.trimStartMs);
  const [end, setEnd] = useState(rec.trimEndMs ?? src);
  useEffect(() => {
     
    setStart(rec.trimStartMs);
    setEnd(rec.trimEndMs ?? rec.sourceDurationMs ?? 0);
  }, [rec.trimStartMs, rec.trimEndMs, rec.sourceDurationMs]);
  const ready = rec.status === "ready" && src > 0 && !rec.locked;
  const dirty = start !== rec.trimStartMs || end !== (rec.trimEndMs ?? src);
  const valid = end - start >= 500 && start >= 0 && end <= src;

  return (
    <div className="rg-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><Scissors className="size-4" aria-hidden />Trim &amp; thumbnail</h2>
      {!ready ? <p className="text-sm text-[color:var(--rg-muted)]">Available once processing finishes, and not after a review decision locks this version.</p> : (
        <>
          <p className="text-sm text-[color:var(--rg-muted)]">Original length {fmtTime(src)}. Trimming is non-destructive and re-renders the video; viewers see “processing” until it’s done.</p>
          <div>
            <label htmlFor="trim-start" className="flex justify-between text-sm font-semibold"><span>Start</span><span className="font-mono">{fmtTime(start)}</span></label>
            <input id="trim-start" type="range" min={0} max={src} step={100} value={start} onChange={(e) => setStart(Math.min(Number(e.target.value), end - 500))} className="w-full accent-[color:var(--brand)]" />
          </div>
          <div>
            <label htmlFor="trim-end" className="flex justify-between text-sm font-semibold"><span>End</span><span className="font-mono">{fmtTime(end)}</span></label>
            <input id="trim-end" type="range" min={0} max={src} step={100} value={end} onChange={(e) => setEnd(Math.max(Number(e.target.value), start + 500))} className="w-full accent-[color:var(--brand)]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rg-btn !min-h-9" onClick={() => setStart(Math.min(rec.trimStartMs + Math.round(playheadMs), end - 500))}>Start at playhead</button>
            <button className="rg-btn !min-h-9" onClick={() => setEnd(Math.max(rec.trimStartMs + Math.round(playheadMs), start + 500))}>End at playhead</button>
            <button className="rg-btn !min-h-9" disabled={!dirty} onClick={() => { setStart(rec.trimStartMs); setEnd(rec.trimEndMs ?? src); }}>Reset</button>
          </div>
          <button className="rg-btn rg-btn-primary" disabled={!dirty || !valid} onClick={() => void patch({ trimStartMs: start, trimEndMs: end >= src ? null : end }, "Trim saved. Re-rendering…")}>Save trim</button>
          <hr className="border-[color:var(--rg-line)]" />
          <button className="rg-btn" onClick={() => void patch({ thumbnailAtMs: Math.round(playheadMs) }, "Thumbnail updated")}><ImageIcon className="size-4" aria-hidden />Use current frame as thumbnail</button>
        </>
      )}
    </div>
  );
}
