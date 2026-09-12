"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CommunityIcon,
  CourseIcon,
  TrophyIcon,
  CalendarIcon,
  SettingsIcon,
} from "@/components/icons/icons";

const nav = [
  { href: "/dashboard", label: "Feed", icon: CommunityIcon },
  { href: "/dashboard/courses", label: "Courses", icon: CourseIcon },
  { href: "/dashboard/leaderboard", label: "Ranks", icon: TrophyIcon },
  { href: "/dashboard/calendar", label: "Events", icon: CalendarIcon },
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed inset-x-4 bottom-4 z-40 flex items-center justify-between rounded-3xl p-2 lg:hidden">
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
              "flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-medium",
              active ? "text-white" : "text-white/50",
            )}
          >
            <item.icon size={30} floaty={active} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
