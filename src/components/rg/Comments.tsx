"use client";

import { useState } from "react";
import { BadgeCheck, MessageSquare, Trash2 } from "lucide-react";
import { fmtTime } from "./StatusBadge";

export type CommentT = {
  id: string; parentId: string | null; atMs: number; outsideTrim: boolean; body: string; createdAt: string;
  author: { name: string; verified: boolean; isOwner: boolean };
  kind?: "comment" | "change_request";
  resolved?: boolean;
};

/** Timestamped, threaded comments. Guests give a display name (marked unverified); signed-in users are marked verified. */
export function Comments({
  comments, allowed, signedIn, currentMs, onSeek, onSubmit, onDelete, onResolve,
}: {
  comments: CommentT[];
  allowed: boolean;
  signedIn: boolean;
  currentMs: () => number;
  onSeek: (ms: number) => void;
  onSubmit: (input: { atMs: number; body: string; parentId?: string; guestName?: string }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onResolve?: (id: string, resolved: boolean) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [name, setName] = useState(() => {
    try { return localStorage.getItem("rg_guest_name") || ""; } catch { return ""; }
  });
  const [reply, setReply] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(0);

  const roots = comments.filter((c) => !c.parentId).sort((a, b) => a.atMs - b.atMs);
  const kids = (id: string) => comments.filter((c) => c.parentId === id);

  async function send(input: { atMs: number; body: string; parentId?: string }) {
    setBusy(true);
    setErr(null);
    try {
      if (!signedIn) try { localStorage.setItem("rg_guest_name", name); } catch {}
      await onSubmit({ ...input, guestName: signedIn ? undefined : name });
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn’t post comment");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const Item = ({ c, nested }: { c: CommentT; nested?: boolean }) => (
    <li className={nested ? "ml-6 border-l-2 border-[color:var(--rg-line)] pl-3" : ""}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {!nested && (
          <button onClick={() => onSeek(c.atMs)} className="min-h-8 rounded-md bg-[color:color-mix(in_srgb,var(--brand)_12%,white)] px-2 font-mono text-xs font-semibold text-[color:var(--brand)]" aria-label={`Jump to ${fmtTime(c.atMs)}`}>
            {fmtTime(c.atMs)}
          </button>
        )}
        <span className="font-semibold">{c.author.name}</span>
        {c.author.verified ? (
          <span className="inline-flex items-center gap-0.5 text-xs text-[color:var(--rg-ok)]" title="Signed-in account"><BadgeCheck className="size-3.5" aria-hidden />{c.author.isOwner ? "Owner" : "Verified"}</span>
        ) : (
          <span className="text-xs text-[color:var(--rg-muted)]" title="Guests enter their own name; it isn’t verified">Guest</span>
        )}
        {c.kind === "change_request" && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.resolved ? "bg-emerald-50 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{c.resolved ? "Change resolved" : "Change requested"}</span>
        )}
        {onResolve && c.kind === "change_request" && (
          <button onClick={() => void onResolve(c.id, !c.resolved)} className="min-h-8 text-xs font-semibold text-[color:var(--brand)]">{c.resolved ? "Reopen" : "Mark resolved"}</button>
        )}
        {c.outsideTrim && <span className="text-xs text-[color:var(--rg-warn)]">(outside trimmed range)</span>}
        <time className="text-xs text-[color:var(--rg-muted)]" dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
        {onDelete && (
          <button onClick={() => void onDelete(c.id)} aria-label="Delete comment" className="ml-auto grid size-8 place-items-center rounded-md text-[color:var(--rg-muted)] hover:bg-red-50 hover:text-[color:var(--rg-bad)]">
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.body}</p>
      {!nested && allowed && (
        <button onClick={() => setReply(reply === c.id ? null : c.id)} className="mt-1 min-h-8 text-xs font-semibold text-[color:var(--brand)]">Reply</button>
      )}
      {!nested && reply === c.id && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ atMs: c.atMs, body: replyBody, parentId: c.id })) {
              setReplyBody("");
              setReply(null);
            }
          }}
        >
          <label className="sr-only" htmlFor={`reply-${c.id}`}>Reply</label>
          <input id={`reply-${c.id}`} className="rg-input" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write a reply" required maxLength={4000} />
          <button className="rg-btn rg-btn-primary" disabled={busy}>Reply</button>
        </form>
      )}
      {!nested && kids(c.id).length > 0 && <ul className="mt-2 space-y-3">{kids(c.id).map((k) => <Item key={k.id} c={k} nested />)}</ul>}
    </li>
  );

  return (
    <div>
      {allowed ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await send({ atMs: stamp, body })) setBody("");
          }}
        >
          {!signedIn && (
            <div>
              <label htmlFor="guest-name" className="text-sm font-semibold">Your name</label>
              <input id="guest-name" className="rg-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} autoComplete="name" />
            </div>
          )}
          <label htmlFor="new-comment" className="text-sm font-semibold">Comment at <span className="font-mono">{fmtTime(stamp)}</span></label>
          <textarea
            id="new-comment"
            className="rg-input min-h-20"
            value={body}
            onFocus={() => setStamp(Math.round(currentMs()))}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment at this moment"
            required
            maxLength={4000}
          />
          <div className="flex items-center gap-2">
            <button className="rg-btn rg-btn-primary" disabled={busy || !body.trim()}>Post comment</button>
            <button type="button" className="rg-btn" onClick={() => setStamp(Math.round(currentMs()))}>Use current time</button>
          </div>
          <p role="alert" className="text-sm text-[color:var(--rg-bad)]">{err}</p>
        </form>
      ) : (
        <p className="text-sm text-[color:var(--rg-muted)]">Comments are turned off for this link.</p>
      )}
      <ul className="mt-5 space-y-5" aria-label="Comments">
        {roots.length === 0 && (
          <li className="flex items-center gap-2 text-sm text-[color:var(--rg-muted)]"><MessageSquare className="size-4" aria-hidden /> No comments yet.</li>
        )}
        {roots.map((c) => <Item key={c.id} c={c} />)}
      </ul>
    </div>
  );
}
