import { Topbar } from "@/components/app/Topbar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { members } from "@/lib/mock-data";

const roleTone = {
  Admin: "orange",
  Moderator: "sky",
  Member: "lavender",
} as const;

export default function MembersPage() {
  return (
    <>
      <Topbar title="Members" />
      <GlassCard className="flex items-center justify-between p-5">
        <div>
          <p className="text-2xl font-extrabold text-white">4,281</p>
          <p className="text-xs text-white/55">total members</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-[var(--c-mint)]">+128</p>
          <p className="text-xs text-white/55">this week</p>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-[var(--c-yellow)]">92%</p>
          <p className="text-xs text-white/55">weekly active</p>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <GlassCard key={m.name} className="flex items-center gap-3.5 p-4">
            <Avatar name={m.name} size={48} ring />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-white">{m.name}</p>
              </div>
              <p className="truncate text-xs text-white/50">{m.tag}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge tone={roleTone[m.role]}>{m.role}</Badge>
                <span className="text-[11px] text-white/40">Lvl {m.level}</span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
