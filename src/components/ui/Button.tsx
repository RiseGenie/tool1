import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonProps = {
  children: ReactNode;
  className?: string;
  variant?: "primary" | "glass" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
};

const variants = {
  primary:
    "text-white shadow-[0_8px_24px_-6px_rgba(255,102,51,0.55)] bg-[linear-gradient(135deg,var(--c-orange),var(--c-pink))] hover:brightness-110 hover:-translate-y-0.5",
  glass:
    "glass text-white hover:-translate-y-0.5 hover:brightness-110",
  ghost:
    "text-white/80 hover:text-white hover:bg-white/10",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  href,
  onClick,
  type = "button",
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 active:translate-y-0 active:brightness-95",
    sizes[size],
    variants[variant],
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  );
}
