import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrophyIcon, CalendarIcon, BoltIcon } from "@/components/icons/icons";
import { members, events } from "@/lib/mock-data";

export function RightRail() {
  const topMembers = members.slice(0, 5);
  const nextEvent = events[0];

  return (
    <aside className="hidden w-80 shrink-0 flex-col gap-4 xl:flex">
      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <BoltIcon size={40} />
          <div>
            <p className="text-sm font-semibold text-white">Your streak</p>
            <p className="text-xs text-white/50">12 days in a row 🔥</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-white/60">
            <span>Level 7</span>
            <span>2,340 / 3,000 XP</span>
          </div>
          <ProgressBar value={78} />
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrophyIcon size={40} />
          <p className="text-sm font-semibold text-white">Top members</p>
        </div>
        <div className="flex flex-col gap-3">
          {topMembers.map((m, i) => (
            <div key={m.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-4 text-xs font-bold text-white/40">
                  #{i + 1}
                </span>
                <Avatar name={m.name} size={30} />
                <span className="text-sm text-white/85">{m.name}</span>
              </div>
              <span className="text-xs font-semibold text-[var(--c-lime)]">
                {m.points.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarIcon size={40} />
          <p className="text-sm font-semibold text-white">Next event</p>
        </div>
        <p className="text-sm font-semibold text-white">{nextEvent.title}</p>
        <p className="mt-1 text-xs text-white/55">
          {nextEvent.date} · {nextEvent.time}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <Badge tone={nextEvent.tone}>{nextEvent.attendees} going</Badge>
        </div>
      </GlassCard>
    </aside>
  );
}
