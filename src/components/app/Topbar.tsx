import { SearchIcon, BellIcon } from "@/components/icons/icons";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

export function Topbar({ title }: { title: string }) {
  return (
    <div className="glass glass-panel flex items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-white sm:text-xl">{title}</h1>
        <Badge tone="mint" className="hidden sm:inline-flex">Live</Badge>
      </div>

      <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-full bg-white/5 px-3 py-2 md:flex">
        <SearchIcon size={26} floaty={false} />
        <input
          placeholder="Search the community..."
          className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button className="relative">
          <BellIcon size={40} floaty={false} />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--c-coral)]" />
        </button>
        <Avatar name="Ava Chen" size={40} ring />
      </div>
    </div>
  );
}
