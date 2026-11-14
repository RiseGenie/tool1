const MAP: Record<string, { label: string; cls: string }> = {
  recording: { label: "Recording", cls: "bg-red-50 text-red-800 border-red-200" },
  uploading: { label: "Uploading", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  processing: { label: "Processing", cls: "bg-blue-50 text-blue-900 border-blue-200" },
  ready: { label: "Ready", cls: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-900 border-red-300" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, cls: "bg-slate-50 text-slate-800 border-slate-200" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export const fmtBytes = (n: number) => (n < 1024 ** 2 ? `${Math.round(n / 1024)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`);
