import { Topbar } from "@/components/app/Topbar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TrophyIcon, BoltIcon } from "@/components/icons/icons";
import { members } from "@/lib/mock-data";

const podiumGradients = [
  ["var(--c-yellow)", "var(--c-orange-solid)"],
  ["var(--c-sky)", "var(--c-lavender)"],
  ["var(--c-coral)", "var(--c-pink)"],
];

export default function LeaderboardPage() {
  const top3 = members.slice(0, 3);
  const rest = members.slice(3);

  return (
    <>
      <Topbar title="Leaderboard" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {top3.map((m, i) => (
          <GlassCard
            key={m.name}
            className="flex flex-col items-center gap-2 p-6 text-center"
            style={i === 0 ? { order: 0 } : undefined}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-extrabold text-white"
              style={{
                background: `linear-gradient(135deg, ${podiumGradients[i][0]}, ${podiumGradients[i][1]})`,
              }}
            >
              {i + 1}
            </div>
            <Avatar name={m.name} size={64} ring />
            <p className="text-sm font-bold text-white">{m.name}</p>
            <Badge tone="yellow">{m.points.toLocaleString()} pts</Badge>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrophyIcon size={40} />
          <p className="font-semibold text-white">All-time ranking</p>
        </div>
        <div className="flex flex-col divide-y divide-white/10">
          {rest.map((m, i) => (
            <div key={m.name} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-sm font-bold text-white/45">
                  #{i + 4}
                </span>
                <Avatar name={m.name} size={38} />
                <div>
                  <p className="text-sm font-medium text-white">{m.name}</p>
                  <p className="text-xs text-white/45">{m.tag}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-xs text-white/50">
                  <BoltIcon size={22} floaty={false} />
                  {m.streak}d streak
                </span>
                <span className="text-sm font-semibold text-[var(--c-lime)]">
                  {m.points.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </>
  );
}
