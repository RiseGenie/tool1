import { CommunityIcon } from "@/components/icons/icons";

export function Footer() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-4 pb-10">
      <div className="glass glass-panel flex flex-col items-center justify-between gap-6 p-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <CommunityIcon size={34} floaty={false} />
          <span className="font-bold text-white">Orbit Circle</span>
        </div>
        <p className="text-sm text-white/50">
          © {new Date().getFullYear()} Orbit Circle. Built for community
          creators.
        </p>
        <div className="flex gap-5 text-sm text-white/60">
          <a href="#features" className="hover:text-white">Features</a>
          <a href="#pricing" className="hover:text-white">Pricing</a>
          <a href="/dashboard" className="hover:text-white">Dashboard</a>
        </div>
      </div>
    </footer>
  );
}
