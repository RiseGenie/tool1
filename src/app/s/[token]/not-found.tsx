import { brand, brandStyle } from "@/lib/brand";
import { Logo } from "@/components/rg/Logo";

export default function NotAvailable() {
  return (
    <div className="rg-app grid place-items-center p-6" style={brandStyle()}>
      <main className="rg-card max-w-md p-8 text-center">
        <Logo className="justify-center" />
        <h1 className="mt-6 text-xl font-bold">This video isn’t available</h1>
        <p className="mt-2 text-sm text-[color:var(--rg-muted)]">
          The link may have been turned off or replaced. Ask the person who sent it to share a new one. — {brand.name}
        </p>
      </main>
    </div>
  );
}
