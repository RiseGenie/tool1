import { Topbar } from "@/components/app/Topbar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SettingsIcon, BellIcon, ShieldIcon } from "@/components/icons/icons";

export default function SettingsPage() {
  return (
    <>
      <Topbar title="Settings" />

      <GlassCard className="flex flex-col items-center gap-4 p-6 sm:flex-row">
        <Avatar name="Ava Chen" size={72} ring />
        <div className="flex-1 text-center sm:text-left">
          <p className="text-lg font-bold text-white">Ava Chen</p>
          <p className="text-sm text-white/50">ava@orbitcircle.com</p>
        </div>
        <Button variant="glass" size="sm">
          Edit profile
        </Button>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon size={36} floaty={false} />
          <p className="font-semibold text-white">Community details</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-white/70">
            Community name
            <input
              defaultValue="Orbit Circle"
              className="rounded-xl bg-white/5 px-3 py-2.5 text-white focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-white/70">
            Community URL
            <input
              defaultValue="orbitcircle.com/c/growth-lab"
              className="rounded-xl bg-white/5 px-3 py-2.5 text-white focus:outline-none"
            />
          </label>
        </div>
        <Button size="sm" className="mt-5">
          Save changes
        </Button>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <BellIcon size={36} floaty={false} />
          <p className="font-semibold text-white">Notifications</p>
        </div>
        <div className="flex flex-col divide-y divide-white/10">
          {[
            "New comments on my posts",
            "Weekly leaderboard summary",
            "Event reminders",
            "Direct messages",
          ].map((label, i) => (
            <div key={label} className="flex items-center justify-between py-3">
              <span className="text-sm text-white/80">{label}</span>
              <div
                className={`h-6 w-11 rounded-full p-1 transition ${
                  i !== 2 ? "bg-[linear-gradient(90deg,var(--c-sky),var(--c-lavender))]" : "bg-white/10"
                }`}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white shadow transition ${
                    i !== 2 ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldIcon size={36} floaty={false} />
          <p className="font-semibold text-white">Billing</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white/5 p-4">
          <div>
            <p className="text-sm font-semibold text-white">Growth plan</p>
            <p className="text-xs text-white/50">$79/month · renews Oct 12</p>
          </div>
          <Badge tone="mint">Active</Badge>
        </div>
        <Button variant="glass" size="sm" className="mt-4">
          Manage billing
        </Button>
      </GlassCard>
    </>
  );
}
