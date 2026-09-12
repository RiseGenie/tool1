import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function GlassCard({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass glass-panel", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
