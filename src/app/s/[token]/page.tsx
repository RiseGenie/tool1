import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { brand, brandStyle } from "@/lib/brand";
import { getSession } from "@/lib/server/auth";
import { resolveShare } from "@/lib/server/recordings";
import { ShareView } from "@/components/rg/ShareView";

export const dynamic = "force-dynamic";

async function load(token: string) {
  try {
    return await resolveShare(token);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const r = await load((await params).token);
  return {
    title: r ? `${r.rec.title} — ${brand.name}` : brand.name,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await load(token);
  if (!r) notFound();
  const session = await getSession().catch(() => null);
  return (
    <div className="rg-app" style={brandStyle()}>
      <ShareView
        token={token}
        title={r.rec.title}
        allowDownload={r.link.allow_download}
        allowComments={r.link.allow_comments}
        signedIn={!!session}
      />
    </div>
  );
}
