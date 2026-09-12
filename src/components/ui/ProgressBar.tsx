export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-white/10 ${className ?? ""}`}>
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,var(--c-sky),var(--c-lavender),var(--c-pink))] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
