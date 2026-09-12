import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import {
  RocketIcon,
  TrophyIcon,
  ChatIcon,
  StarBurstIcon,
  HeartIcon,
  BoltIcon,
} from "@/components/icons/icons";

export function Hero() {
  return (
    <section className="relative mx-auto mt-16 flex w-full max-w-6xl flex-col items-center px-4 text-center sm:mt-24">
      <div className="pointer-events-none absolute -top-10 left-1/2 h-16 w-16 -translate-x-[220px] sm:-translate-x-[320px]">
        <StarBurstIcon size={64} />
      </div>
      <div className="pointer-events-none absolute top-24 right-2 hidden sm:block">
        <BoltIcon size={52} />
      </div>
      <div className="pointer-events-none absolute -top-4 right-1/2 translate-x-[240px] sm:translate-x-[340px]">
        <HeartIcon size={48} className="animate-float-slow" />
      </div>

      <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white/85">
        <span className="h-2 w-2 rounded-full bg-[var(--c-mint)] animate-pulse-glow" />
        Now in public beta — join 4,200+ community builders
      </div>

      <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
        Build a community
        <br />
        people <span className="text-shimmer">never want to leave</span>
      </h1>

      <p className="mt-6 max-w-xl text-balance text-base text-white/70 sm:text-lg">
        Orbit Circle brings discussions, courses, events, and gamified
        engagement into one gorgeous space — everything you need to grow a
        thriving paid community.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button href="/dashboard" size="lg">
          <RocketIcon size={26} floaty={false} />
          Launch your community
        </Button>
        <Button href="#how-it-works" variant="glass" size="lg">
          <ChatIcon size={26} floaty={false} />
          See how it works
        </Button>
      </div>

      <div className="mt-8 flex items-center gap-3 text-sm text-white/60">
        <div className="flex -space-x-3">
          {["Ava Chen", "Marcus Lee", "Priya Nair", "Sofia Reyes"].map((n) => (
            <Avatar key={n} name={n} size={34} ring className="ring-offset-0" />
          ))}
        </div>
        <span>Loved by 4,200+ creators and their members</span>
      </div>

      <GlassCard className="relative mt-16 w-full overflow-hidden p-3 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassCard className="glass-light col-span-1 flex flex-col gap-3 !bg-white/[0.06] p-5 text-left sm:col-span-2">
            <div className="flex items-center gap-3">
              <TrophyIcon size={44} />
              <div>
                <p className="text-sm font-semibold text-white">Weekly Leaderboard</p>
                <p className="text-xs text-white/55">Top members this week</p>
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-2.5">
              {[
                ["Ava Chen", 12840, 1],
                ["Marcus Lee", 9210, 2],
                ["Priya Nair", 8110, 3],
              ].map(([name, pts, rank]) => (
                <div
                  key={name as string}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 text-xs font-bold text-white/50">#{rank}</span>
                    <Avatar name={name as string} size={28} />
                    <span className="text-sm font-medium text-white">{name}</span>
                  </div>
                  <span className="text-xs font-semibold text-[var(--c-lime)]">
                    {pts} pts
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="glass-light flex flex-col items-center justify-center gap-3 !bg-white/[0.06] p-5 text-center">
            <RocketIcon size={56} />
            <p className="text-sm font-semibold text-white">Level 7 unlocked!</p>
            <p className="text-xs text-white/55">+150 XP for your daily streak</p>
          </GlassCard>
        </div>
      </GlassCard>
    </section>
  );
}
