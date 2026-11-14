"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GitBranch, Lock } from "lucide-react";
import { jfetch } from "@/lib/recorder/api";
import { StatusBadge } from "./StatusBadge";

type V = { id: string; versionNo: number; label: string | null; isDraft: boolean; locked: boolean; status: string; openChangeRequests: number; decisions: { id: string; decision: string; reviewerName: string; verified: boolean; createdAt: string }[] };
const REVIEW: Record<string, string> = { pending: "No decision yet", approved: "Approved", changes_requested: "Changes requested" };

export function VersionsPanel({ id, ready, isDraft, locked, onChange }: { id: string; ready: boolean; isDraft: boolean; locked: boolean; onChange: () => void }) {
  const [versions, setVersions] = useState<V[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await jfetch<{ versions: V[] }>(`/api/recordings/${id}/review`).catch(() => null);
    if (r) setVersions(r.versions);
  }, [id]);
  useEffect(() => { void load(); }, [load, ready]);

  async function newVersion() {
    setMsg(null);
    try {
      const r = await jfetch<{ recording: { id: string } }>(`/api/recordings/${id}/versions`, { method: "POST", json: {} });
      location.assign(`/app/v/${r.recording.id}`);
    } catch (e) { setMsg((e as Error).message); }
  }
  async function publish() {
    setMsg(null);
    try {
      await jfetch(`/api/recordings/${id}/publish`, { method: "POST" });
      setMsg("Published. Share links now show this version and start a new review.");
      await load();
      onChange();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="rg-card space-y-3 p-4">
      <h2 className="flex items-center gap-2 font-semibold"><GitBranch className="size-4" aria-hidden />Versions &amp; review</h2>
      {isDraft && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Draft — not visible to reviewers</p>
          <p>Redact or trim, wait for it to render, then publish. Share links keep showing the current published version until then.</p>
          <button className="rg-btn rg-btn-primary mt-2" disabled={!ready} onClick={publish}>Publish this version</button>
        </div>
      )}
      {locked && <p className="flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden />This version has a review decision, so its content is frozen. Create a new version to change it.</p>}
      <ol className="space-y-2">
        {versions.map((v) => (
          <li key={v.id} className={`rounded-lg border p-2 text-sm ${v.id === id ? "border-[color:var(--brand)]" : "border-[color:var(--rg-line)]"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/app/v/${v.id}`} className="font-semibold underline-offset-2 hover:underline">v{v.versionNo}{v.label ? ` · ${v.label}` : ""}</Link>
              {v.isDraft ? <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-900">Draft</span> : <StatusBadge status={v.status === "ready" ? "ready" : v.status} />}
              {!v.isDraft && <span className="text-xs text-[color:var(--rg-muted)]">{REVIEW[v.status] ?? v.status}</span>}
            </div>
            {v.openChangeRequests > 0 && <p className="mt-1 text-xs font-semibold text-amber-900">{v.openChangeRequests} open change request{v.openChangeRequests > 1 ? "s" : ""}</p>}
            {v.decisions.map((d) => <p key={d.id} className="mt-1 text-xs text-[color:var(--rg-muted)]">{d.decision === "approved" ? "Approved" : "Changes requested"} by {d.reviewerName} ({d.verified ? "verified" : "guest"}) · {new Date(d.createdAt).toLocaleString()}</p>)}
          </li>
        ))}
      </ol>
      {!isDraft && <button className="rg-btn" disabled={!ready} onClick={newVersion}>Create replacement version</button>}
      <p role="status" className="text-sm text-[color:var(--rg-ok)]">{msg}</p>
    </div>
  );
}
