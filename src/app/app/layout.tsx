import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand, brandStyle } from "@/lib/brand";
import { getSession } from "@/lib/server/auth";
import { Logo } from "@/components/rg/Logo";

export const metadata: Metadata = { title: { default: brand.name, template: `%s — ${brand.name}` }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await getSession();
  } catch {
    return (
      <div className="rg-app grid place-items-center p-6" style={brandStyle()}>
        <main className="rg-card max-w-lg p-8">
          <h1 className="text-xl font-bold">Authentication isn’t configured</h1>
          <p className="mt-2 text-sm text-[color:var(--rg-muted)]">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>), then redeploy.
          </p>
        </main>
      </div>
    );
  }
  if (!session) redirect("/login");
  return (
    <div className="rg-app" style={brandStyle()}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-[color:var(--rg-line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/app" className="rounded-lg"><Logo /></Link>
          <nav aria-label="Main" className="ml-4 hidden gap-1 sm:flex">
            <Link href="/app" className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">Library</Link>
            <Link href="/app/requests" className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">Requests</Link>
            <Link href="/app/bug" className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-slate-100">Bug reports</Link>
          </nav>
          <div className="flex-1" />
          <Link href="/app/record" className="rg-btn rg-btn-primary">
            <span aria-hidden className="size-2.5 rounded-full bg-[color:var(--brand-accent)] ring-2 ring-white/70" /> New recording
          </Link>
          <form action="/api/logout" method="post" className="hidden items-center gap-2 sm:flex">
            <span className="max-w-40 truncate text-sm text-[color:var(--rg-muted)]" title={session.email}>{session.email}</span>
            <button className="rg-btn">Sign out</button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
