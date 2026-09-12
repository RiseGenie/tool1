import { GlassIconShell, type GlassIconProps } from "./GlassIcon";

const stroke = "rgba(255,255,255,0.95)";

export function CommunityIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-lavender)", "var(--c-pink)"]} {...props}>
      <circle cx="12" cy="7.5" r="2.6" stroke={stroke} strokeWidth="1.6" />
      <circle cx="6" cy="9.5" r="1.9" stroke={stroke} strokeWidth="1.4" opacity="0.85" />
      <circle cx="18" cy="9.5" r="1.9" stroke={stroke} strokeWidth="1.4" opacity="0.85" />
      <path d="M4 19c0-2.8 2.2-4.6 4.5-4.6" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M20 19c0-2.8-2.2-4.6-4.5-4.6" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M7 20c0-3.3 2.2-5.4 5-5.4s5 2.1 5 5.4" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
    </GlassIconShell>
  );
}

export function CourseIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-sky)", "var(--c-indigo)"]} {...props}>
      <path d="M4 6.2c2.6-1.3 5.4-1.3 8 0v11.6c-2.6-1.3-5.4-1.3-8 0V6.2Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20 6.2c-2.6-1.3-5.4-1.3-8 0v11.6c2.6-1.3 5.4-1.3 8 0V6.2Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function ChatIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-mint)", "var(--c-sky)"]} {...props}>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 3.2V15H7.5A2.5 2.5 0 0 1 5 12.5v-6Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="9.8" r="0.9" fill={stroke} />
      <circle cx="12" cy="9.8" r="0.9" fill={stroke} />
      <circle cx="15" cy="9.8" r="0.9" fill={stroke} />
    </GlassIconShell>
  );
}

export function CalendarIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-orange)", "var(--c-yellow)"]} {...props}>
      <rect x="4" y="5.5" width="16" height="14" rx="2.4" stroke={stroke} strokeWidth="1.5" />
      <path d="M4 9.5h16" stroke={stroke} strokeWidth="1.5" />
      <path d="M8 3.5v3M16 3.5v3" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8.5" cy="13" r="1" fill={stroke} />
      <circle cx="12" cy="13" r="1" fill={stroke} opacity="0.85" />
      <circle cx="15.5" cy="13" r="1" fill={stroke} opacity="0.7" />
    </GlassIconShell>
  );
}

export function TrophyIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-yellow)", "var(--c-orange-solid)"]} {...props}>
      <path d="M8 5h8v4a4 4 0 0 1-4 4a4 4 0 0 1-4-4V5Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6H5.5A1.5 1.5 0 0 0 4 7.5c0 1.7 1.4 3 3 3" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M16 6h2.5A1.5 1.5 0 0 1 20 7.5c0 1.7-1.4 3-3 3" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 13v3M9 19h6M9.5 19c0-1.8.9-2.6 2.5-2.6s2.5.8 2.5 2.6" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function MembersIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-pink)", "var(--c-lavender)"]} {...props}>
      <circle cx="9" cy="8" r="3" stroke={stroke} strokeWidth="1.6" />
      <path d="M3.5 19c0-3.3 2.5-5.4 5.5-5.4s5.5 2.1 5.5 5.4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M15.5 6.5a3 3 0 0 1 0 5.8" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
      <path d="M16 13.7c2.4.4 4 2.3 4 5.3" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
    </GlassIconShell>
  );
}

export function RocketIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-orange)", "var(--c-coral)"]} {...props}>
      <path d="M12 3c2.8 1.6 4.5 4.6 4.5 8.2 0 1.7-.4 3.2-1 4.4l-3.5 1.9-3.5-1.9c-.6-1.2-1-2.7-1-4.4C7.5 7.6 9.2 4.6 12 3Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="1.6" stroke={stroke} strokeWidth="1.4" />
      <path d="M8.7 15.5 6 18.5M15.3 15.5 18 18.5" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10 18.6 9 21M14 18.6l1 2.4" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </GlassIconShell>
  );
}

export function HeartIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-coral)", "var(--c-pink)"]} {...props}>
      <path d="M12 19.4s-6.8-4.1-9-8.1C1.4 8.3 3 5 6.2 5c1.9 0 3.3 1 4.8 2.7C12.5 6 13.9 5 15.8 5 19 5 20.6 8.3 21 11.3c-2.2 4-9 8.1-9 8.1Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function BellIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-lime)", "var(--c-mint)"]} {...props}>
      <path d="M6.5 10.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.2 1.5 5.2H5s1.5-1.2 1.5-5.2Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 18.3a2 2 0 0 0 4 0" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
    </GlassIconShell>
  );
}

export function SettingsIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-indigo)", "var(--c-lavender)"]} {...props}>
      <circle cx="12" cy="12" r="2.6" stroke={stroke} strokeWidth="1.5" />
      <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.8 6.8l1.4 1.4M15.8 15.8l1.4 1.4M6.8 17.2l1.4-1.4M15.8 8.2l1.4-1.4" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
    </GlassIconShell>
  );
}

export function StarBurstIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-yellow)", "var(--c-lime)"]} {...props}>
      <path d="M12 3.5 13.6 9l5.4-1.7L15.5 12l3.5 4.7L13.6 15 12 20.5 10.4 15l-5.4 1.7L8.5 12 5 7.3 10.4 9 12 3.5Z" stroke={stroke} strokeWidth="1.3" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function ShieldIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-sky)", "var(--c-lavender)"]} {...props}>
      <path d="M12 3.5 18.5 6v5.3c0 4-2.8 6.9-6.5 9.2-3.7-2.3-6.5-5.2-6.5-9.2V6L12 3.5Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4.2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function BoltIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-orange-solid)", "var(--c-yellow)"]} {...props}>
      <path d="M13 3 6 13.5h4.5L11 21l7-11h-4.5L13 3Z" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function GiftIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-pink)", "var(--c-coral)"]} {...props}>
      <rect x="4.5" y="9.5" width="15" height="10" rx="1.6" stroke={stroke} strokeWidth="1.5" />
      <path d="M4.5 12.8h15" stroke={stroke} strokeWidth="1.5" />
      <path d="M12 9.5v10" stroke={stroke} strokeWidth="1.5" />
      <path d="M12 9.5c0-2.4-1.6-4-3.4-4S6 6.7 6 8.2 7.4 9.5 8.6 9.5H12Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 9.5c0-2.4 1.6-4 3.4-4S18 6.7 18 8.2 16.6 9.5 15.4 9.5H12Z" stroke={stroke} strokeWidth="1.4" strokeLinejoin="round" />
    </GlassIconShell>
  );
}

export function SearchIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-lavender)", "var(--c-sky)"]} {...props}>
      <circle cx="10.5" cy="10.5" r="5" stroke={stroke} strokeWidth="1.6" />
      <path d="M18 18l-3.4-3.4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </GlassIconShell>
  );
}

export function PlayIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-mint)", "var(--c-lime)"]} {...props}>
      <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.4" opacity="0.7" />
      <path d="M10 8.5v7l6-3.5-6-3.5Z" fill={stroke} />
    </GlassIconShell>
  );
}

export function CheckIcon(props: GlassIconProps) {
  return (
    <GlassIconShell gradient={["var(--c-mint)", "var(--c-sky)"]} {...props}>
      <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.4" opacity="0.6" />
      <path d="M8.3 12.3l2.6 2.6 5-5.4" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </GlassIconShell>
  );
}
