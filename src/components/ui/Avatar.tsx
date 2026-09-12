import { cn } from "@/lib/utils";

const gradients = [
  ["var(--c-orange)", "var(--c-pink)"],
  ["var(--c-sky)", "var(--c-lavender)"],
  ["var(--c-mint)", "var(--c-sky)"],
  ["var(--c-yellow)", "var(--c-orange-solid)"],
  ["var(--c-pink)", "var(--c-lavender)"],
  ["var(--c-lime)", "var(--c-mint)"],
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

export function Avatar({
  name,
  size = 40,
  className,
  ring = false,
}: {
  name: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const [a, b] = gradients[hashName(name) % gradients.length];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full font-bold text-white shrink-0",
        ring && "ring-2 ring-white/40 ring-offset-2 ring-offset-transparent",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${a}, ${b})`,
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.5), 0 4px 10px -2px rgba(0,0,0,0.35)",
      }}
    >
      {initials}
    </div>
  );
}
