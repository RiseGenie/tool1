import { CONTACT, NAV, SOCIALS } from "@/lib/data";

export default function Footer() {
  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="text-[clamp(3rem,13vw,11rem)] font-bold leading-[0.85] tracking-tighter text-green">RiseGenie<span className="text-paper">.</span></p>
        <p className="mt-4 max-w-md font-medium">Powering your growth, simplifying your success with comprehensive digital marketing solutions.</p>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-label="Footer"><h3 className="font-mono text-sm font-bold uppercase text-green">Explore</h3>
            <ul className="mt-3 space-y-2">{NAV.map((n) => <li key={n.id}><a className="font-bold hover:text-green hover:underline" href={`#${n.id}`}>{n.label}</a></li>)}</ul></nav>
          <div><h3 className="font-mono text-sm font-bold uppercase text-green">Legal</h3>
            <ul className="mt-3 space-y-2">{[["Terms of Use", "terms-and-conditions"], ["Privacy Policy", "privacy-policy"], ["Refund Policy", "refund"], ["Sitemap", "sitemap"]].map(([l, p]) => <li key={p}><a className="font-bold hover:text-green hover:underline" href={`https://risegenie.com/${p}`}>{l}</a></li>)}</ul></div>
          <div><h3 className="font-mono text-sm font-bold uppercase text-green">Follow</h3>
            <ul className="mt-3 flex flex-wrap gap-2">{SOCIALS.map((s) => <li key={s.label}><a className="inline-block border-2 border-paper px-3 py-1 font-bold transition-colors hover:bg-green hover:text-ink" target="_blank" rel="noopener noreferrer" href={s.href}>{s.label}</a></li>)}</ul></div>
          <div><h3 className="font-mono text-sm font-bold uppercase text-green">Visit</h3>
            <p className="mt-3 font-medium">{CONTACT.address}</p><p className="mt-1 font-mono">{CONTACT.phone}</p></div>
        </div>
        <p className="mt-14 border-t-2 border-paper/30 pt-6 font-mono text-sm">© {new Date().getFullYear()} RiseGenie LLC. All rights reserved.</p>
      </div>
    </footer>
  );
}
