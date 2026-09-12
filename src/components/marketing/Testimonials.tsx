import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { StarBurstIcon } from "@/components/icons/icons";

const quotes = [
  {
    name: "Ava Chen",
    role: "Founder, Growth Lab",
    quote:
      "We moved 1,800 members off Facebook groups in a week. Engagement tripled once the leaderboard went live.",
  },
  {
    name: "Marcus Lee",
    role: "Coach, Momentum",
    quote:
      "The courses + community combo means members finish what they start. Refunds dropped to almost zero.",
  },
  {
    name: "Sofia Reyes",
    role: "Creator, Daily Craft",
    quote:
      "It genuinely feels alive. The glass UI and animations make it feel premium, not just another forum.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="mx-auto mt-32 w-full max-w-6xl px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Community builders love Orbit Circle.
        </h2>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {quotes.map((q) => (
          <GlassCard key={q.name} className="flex flex-col gap-4 p-7">
            <StarBurstIcon size={40} floaty={false} />
            <p className="flex-1 text-sm leading-relaxed text-white/80">
              &ldquo;{q.quote}&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <Avatar name={q.name} size={38} />
              <div>
                <p className="text-sm font-semibold text-white">{q.name}</p>
                <p className="text-xs text-white/50">{q.role}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
