import { cn } from "@/lib/utils";

export type GlassIconProps = {
  size?: number;
  className?: string;
  gradient?: [string, string];
  floaty?: boolean;
};

const SIZE_DEFAULT = 56;

/**
 * Shared shell that gives every icon its glassmorphic 3D look:
 * a soft gradient blob, a frosted glass panel on top, and a specular highlight.
 */
export function GlassIconShell({
  size = SIZE_DEFAULT,
  className,
  gradient = ["var(--c-lavender)", "var(--c-sky)"],
  floaty = true,
  children,
}: GlassIconProps & { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "icon-3d",
        floaty && "animate-float",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-[22px] opacity-90 animate-pulse-glow"
        style={{
          background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
          filter: "blur(0.5px)",
        }}
      />
      <svg
        viewBox="0 0 24 24"
        width={size * 0.56}
        height={size * 0.56}
        className="relative z-[2] drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
        fill="none"
      >
        {children}
      </svg>
    </div>
  );
}
