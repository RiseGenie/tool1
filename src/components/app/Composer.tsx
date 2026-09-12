import { Avatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { GiftIcon, PlayIcon, CalendarIcon } from "@/components/icons/icons";

export function Composer() {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <Avatar name="Ava Chen" size={40} />
        <input
          placeholder="Share a win, ask a question, start a discussion..."
          className="flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1">
          <button className="rounded-full p-1 text-white/50 hover:text-white">
            <PlayIcon size={30} floaty={false} />
          </button>
          <button className="rounded-full p-1 text-white/50 hover:text-white">
            <GiftIcon size={30} floaty={false} />
          </button>
          <button className="rounded-full p-1 text-white/50 hover:text-white">
            <CalendarIcon size={30} floaty={false} />
          </button>
        </div>
        <Button size="sm">Post</Button>
      </div>
    </GlassCard>
  );
}
