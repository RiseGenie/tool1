import type { Metadata } from "next";
import { brand, brandStyle } from "@/lib/brand";
import { env } from "@/lib/server/env";
import { Logo } from "@/components/rg/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: `Sign in — ${brand.name}`, robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="rg-app grid place-items-center p-4" style={brandStyle()}>
      <main className="rg-card w-full max-w-sm p-8">
        <Logo className="text-lg" />
        <h1 className="mt-6 text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-[color:var(--rg-muted)]">{brand.tagline}</p>
        <LoginForm supabase={!!env.supabase} dev={env.devAuth} />
      </main>
    </div>
  );
}
