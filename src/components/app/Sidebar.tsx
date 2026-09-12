"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CommunityIcon,
  CourseIcon,
  MembersIcon,
  TrophyIcon,
  CalendarIcon,
  SettingsIcon,
} from "@/components/icons/icons";

const nav = [
  { href: "/dashboard", label: "Community", icon: CommunityIcon },
  { href: "/dashboard/courses", label: "Classroom", icon: CourseIcon },
  { href: "/dashboard/members", label: "Members", icon: MembersIcon },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: TrophyIcon },
  { href: "/dashboard/calendar", label: "Events", icon: CalendarIcon },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass glass-panel sticky top-4 hidden h-[calc(100dvh-2rem)] w-64 shrink-0 flex-col p-4 lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2 py-2">
        <CommunityIcon size={36} floaty={false} />
        <span className="font-bold tracking-tight text-white">
          Orbit <span className="text-shimmer">Circle</span>
        </span>
      </Link>

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "glass text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon size={34} floaty={active} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="glass mt-4 flex flex-col gap-2 p-4 text-center">
        <p className="text-xs font-semibold text-white">Upgrade to Growth</p>
        <p className="text-[11px] text-white/55">
          Unlock unlimited members &amp; courses
        </p>
        <Link
          href="/#pricing"
          className="mt-1 rounded-full bg-[linear-gradient(135deg,var(--c-orange),var(--c-pink))] px-3 py-1.5 text-xs font-semibold text-white"
        >
          View plans
        </Link>
      </div>
    </aside>
  );
}
