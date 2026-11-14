import { brand } from "@/lib/brand";

/** Configurable logo: set NEXT_PUBLIC_BRAND_LOGO_URL to use an image, otherwise the built-in mark is drawn. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt="" className="size-8 rounded-lg object-contain" />
      ) : (
        <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
          <rect width="32" height="32" rx="9" fill="var(--brand)" />
          <path d="M7 21c3-8 9-11 18-10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" opacity=".55" />
          <circle cx="16" cy="17" r="5.2" fill="var(--brand-accent)" />
        </svg>
      )}
      <span>{brand.name}</span>
    </span>
  );
}
