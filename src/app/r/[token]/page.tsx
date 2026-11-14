import type { Metadata } from "next";
import { brand, brandStyle } from "@/lib/brand";
import { Logo } from "@/components/rg/Logo";
import { RequestResponder } from "@/components/rg/RequestResponder";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: `Send a video — ${brand.name}`, robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="rg-app" style={brandStyle()}>
      <header className="border-b border-[color:var(--rg-line)] bg-white"><div className="mx-auto flex h-14 max-w-3xl items-center px-4"><Logo /></div></header>
      <main className="mx-auto max-w-3xl px-4 py-6"><RequestResponder token={token} /></main>
    </div>
  );
}
