import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const tones: Record<string, string> = {
  orange: "bg-[color-mix(in_srgb,var(--c-orange)_25%,transparent)] text-[var(--c-orange)] border-[color-mix(in_srgb,var(--c-orange)_45%,transparent)]",
  sky: "bg-[color-mix(in_srgb,var(--c-sky)_25%,transparent)] text-[var(--c-sky)] border-[color-mix(in_srgb,var(--c-sky)_45%,transparent)]",
  mint: "bg-[color-mix(in_srgb,var(--c-mint)_25%,transparent)] text-[var(--c-mint)] border-[color-mix(in_srgb,var(--c-mint)_45%,transparent)]",
  pink: "bg-[color-mix(in_srgb,var(--c-pink)_25%,transparent)] text-[var(--c-pink)] border-[color-mix(in_srgb,var(--c-pink)_45%,transparent)]",
  yellow: "bg-[color-mix(in_srgb,var(--c-yellow)_25%,transparent)] text-[var(--c-yellow)] border-[color-mix(in_srgb,var(--c-yellow)_45%,transparent)]",
  lavender: "bg-[color-mix(in_srgb,var(--c-lavender)_25%,transparent)] text-[var(--c-lavender)] border-[color-mix(in_srgb,var(--c-lavender)_45%,transparent)]",
};

export function Badge({
  children,
  tone = "sky",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur-sm",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
