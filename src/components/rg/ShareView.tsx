"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { Logo } from "./Logo";
import { Player, type Media, type PlayerHandle } from "./Player";
import { Transcript, type Segment } from "./Transcript";
import { Comments, type CommentT } from "./Comments";
import { GuestReview } from "./GuestReview";

type Meta = { playable: boolean; status: string; transcriptStatus: string; durationMs: number | null; allowDownload: boolean; allowComments: boolean; revision: number };

/** Guest viewer. Mobile-first: single column, 44px+ touch targets, no account required. */
export function ShareView({ token, title, allowDownload, allowComments, signedIn }: { token: string; title: string; allowDownload: boolean; allowComments: boolean; signedIn: boolean }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [gone, setGone] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [comments, setComments] = useState<CommentT[]>([]);
  const [allowed, setAllowed] = useState(allowComments);
  const [ms, setMs] = useState(0);
  const [tab, setTab] = useState<"comments" | "transcript">("comments");
  const player = useRef<PlayerHandle>(null);
  const sessionId = useRef<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await jfetch<Meta>(`/api/share/${token}`));
    } catch (e) {
      if ((e as { status?: number }).status === 404) setGone(true);
    }
  }, [token]);

  const loadComments = useCallback(async () => {
    try {
      const r = await jfetch<{ allowed: boolean; comments: CommentT[] }>(`/api/share/${token}/comments`);
      setComments(r.comments);
      setAllowed(r.allowed);
    } catch (e) {
      if ((e as { status?: number }).status === 404) setGone(true);
    }
  }, [token]);

  useEffect(() => {
     
    void loadMeta();
    void loadComments();
  }, [loadMeta, loadComments]);

  // While processing, keep checking until the video (and transcript) are ready.
  const waiting = meta && (!meta.playable || ["queued", "processing"].includes(meta.transcriptStatus));
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void loadMeta(), 3000);
    return () => clearInterval(t);
  }, [waiting, loadMeta]);

  const transcriptReady = meta?.transcriptStatus === "ready";
  useEffect(() => {
    if (!transcriptReady) return;
    jfetch<{ segments: Segment[] }>(`/api/share/${token}/transcript`).then((r) => setSegments(r.segments)).catch(() => {});
  }, [transcriptReady, token, meta?.revision]);

  // Every call re-checks access on the server and returns a fresh short-lived URL.
  const getMedia = useCallback(async (): Promise<Media> => {
    const r = await jfetch<Media & { sessionId: string }>(`/api/share/${token}/media`, { method: "POST" });
    sessionId.current ??= r.sessionId;
    return r;
  }, [token]);

  const heartbeat = useCallback(
    (watchedMs: number) => {
      if (!sessionId.current || watchedMs <= 0) return;
      void fetch(`/api/share/${token}/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, watchedMs }),
        keepalive: true,
      }).catch(() => {});
    },
    [token],
  );

  if (gone)
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="rg-card max-w-md p-8 text-center" role="alert">
          <h1 className="text-xl font-bold">This video isn’t available</h1>
          <p className="mt-2 text-sm text-[color:var(--rg-muted)]">The link was turned off. Ask the sender for a new one.</p>
        </div>
      </main>
    );

  return (
    <div>
      <header className="border-b border-[color:var(--rg-line)] bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center px-4"><Logo /></div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-4 lg:grid-cols-[1fr_380px] lg:py-6">
        <div className="min-w-0">
          {meta?.playable ? (
            <Player
              key={meta.revision}
              ref={player}
              getMedia={getMedia}
              captionsUrl={transcriptReady ? `/api/share/${token}/captions` : null}
              onTime={setMs}
              onWatched={(w) => heartbeat(w)}
              onUnavailable={() => setGone(true)}
            />
          ) : (
            <div role="status" className="grid aspect-video place-items-center rounded-2xl bg-[#14142b] p-6 text-center text-white">
              <div>
                <p className="text-lg font-semibold">{meta?.status === "failed" ? "This video couldn’t be processed." : "This video is still processing…"}</p>
                <p className="mt-1 text-sm text-white/70">{meta?.status === "failed" ? "Please let the sender know." : "It will start playing here automatically."}</p>
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <h1 className="min-w-0 flex-1 text-xl font-bold sm:text-2xl">{title}</h1>
            {(meta?.allowDownload ?? allowDownload) && meta?.playable && (
              <a href={`/api/share/${token}/download`} className="rg-btn"><Download className="size-4" aria-hidden />Download</a>
            )}
          </div>
        </div>

        <div>
        {meta?.playable && allowed && <GuestReview token={token} signedIn={signedIn} version={meta.revision} currentMs={() => player.current?.currentMs() ?? 0} onDone={() => void loadComments()} />}
        <section className="rg-card p-4" aria-label="Transcript and comments">
          <div role="tablist" aria-label="Comments and transcript" className="mb-3 flex gap-1">
            {(["comments", "transcript"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold capitalize sm:flex-none ${tab === t ? "bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] text-[color:var(--brand)]" : "hover:bg-slate-100"}`}>
                {t}{t === "comments" ? ` (${comments.length})` : ""}
              </button>
            ))}
          </div>
          {tab === "transcript" ? (
            <Transcript segments={segments} status={meta?.transcriptStatus ?? "queued"} currentMs={ms} onSeek={(t) => player.current?.seek(t)} />
          ) : (
            <Comments
              comments={comments}
              allowed={allowed}
              signedIn={signedIn}
              currentMs={() => player.current?.currentMs() ?? 0}
              onSeek={(t) => { player.current?.seek(t); player.current?.play(); }}
              onSubmit={async (c) => { await jfetch(`/api/share/${token}/comments`, { method: "POST", json: c }); await loadComments(); }}
            />
          )}
        </section>
        </div>
      </main>
    </div>
  );
}
