import { GlassCard } from "@/components/ui/GlassCard";
import { RocketIcon, MembersIcon, GiftIcon } from "@/components/icons/icons";

const steps = [
  {
    icon: RocketIcon,
    step: "01",
    title: "Design your space",
    desc: "Pick a theme, add your branding, and structure your channels, courses, and events in minutes.",
  },
  {
    icon: MembersIcon,
    step: "02",
    title: "Invite your members",
    desc: "Import your audience or share your community link — free and paid tiers set up in one click.",
  },
  {
    icon: GiftIcon,
    step: "03",
    title: "Grow with gamification",
    desc: "Points, levels, and leaderboards keep members coming back, posting, and inviting others.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto mt-32 w-full max-w-6xl px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Live in an afternoon.
        </h2>
        <p className="mt-4 text-white/65">
          No code, no plugins, no headaches — just a community that feels
          alive from day one.
        </p>
      </div>

      <div className="relative mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="pointer-events-none absolute top-1/2 left-0 hidden h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent md:block" />
        {steps.map((s) => (
          <GlassCard key={s.step} className="relative flex flex-col items-center gap-4 p-8 text-center">
            <span className="text-shimmer text-sm font-bold tracking-widest">{s.step}</span>
            <s.icon size={64} />
            <h3 className="text-xl font-bold text-white">{s.title}</h3>
            <p className="text-sm leading-relaxed text-white/60">{s.desc}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
