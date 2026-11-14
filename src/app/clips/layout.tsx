import type { Metadata } from "next";
import Link from "next/link";
import { Video } from "lucide-react";

export const metadata: Metadata = {
  title: "Glimpse — record and share quick videos",
  description: "A private, local-first screen recorder. Capture your screen and camera, then replay, comment and download.",
};

export default function ClipsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/clips" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white">
              <Video className="size-4" />
            </span>
            Glimpse
          </Link>
          <Link
            href="/clips/record"
            className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <span className="size-2 rounded-full bg-rose-300" /> Record
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
