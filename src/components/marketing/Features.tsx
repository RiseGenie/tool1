import { GlassCard } from "@/components/ui/GlassCard";
import {
  CommunityIcon,
  CourseIcon,
  CalendarIcon,
  TrophyIcon,
  ChatIcon,
  ShieldIcon,
} from "@/components/icons/icons";

const features = [
  {
    icon: CommunityIcon,
    title: "Discussion Feed",
    desc: "Threaded posts, reactions, and rich media so members show up daily — not just scroll and leave.",
  },
  {
    icon: CourseIcon,
    title: "Classroom & Courses",
    desc: "Drip-fed lessons, progress tracking, and completion certificates baked right into the community.",
  },
  {
    icon: TrophyIcon,
    title: "Gamified Levels",
    desc: "Points, streaks, and leaderboards that turn engagement into a game your members want to win.",
  },
  {
    icon: CalendarIcon,
    title: "Events & Calendar",
    desc: "Host live workshops, AMAs, and co-working sessions with RSVPs and automatic reminders.",
  },
  {
    icon: ChatIcon,
    title: "Real-time Chat",
    desc: "Instant messaging and topic channels keep the energy going between big discussions.",
  },
  {
    icon: ShieldIcon,
    title: "Membership & Billing",
    desc: "Free and paid tiers, gated content, and one-click checkout — monetize from day one.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto mt-32 w-full max-w-6xl px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Everything your community needs.
          <span className="text-shimmer"> One place.</span>
        </h2>
        <p className="mt-4 text-white/65">
          Stop stitching together five different tools. Orbit Circle replaces
          your forum, LMS, event platform, and payment processor.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <GlassCard
            key={f.title}
            className="group p-6 transition-transform duration-300 hover:-translate-y-1.5"
          >
            <f.icon size={56} />
            <h3 className="mt-5 text-lg font-bold text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{f.desc}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
