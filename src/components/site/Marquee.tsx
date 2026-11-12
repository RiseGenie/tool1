const WORDS = ["Automation", "GoHighLevel", "SEO", "Funnels", "AI Calling", "PPC", "Branding", "Email", "CRM", "Lead Gen"];

export default function Marquee() {
  const row = [...WORDS, ...WORDS];
  return (
    <div className="marquee overflow-hidden border-b-[3px] border-ink bg-ink py-4 text-paper" aria-hidden>
      <div className="marquee-track flex gap-8 whitespace-nowrap text-3xl font-bold uppercase sm:text-4xl">
        {[...row, ...row].map((w, i) => (
          <span key={i} className="flex items-center gap-8">
            {w}<span className="text-green">✺</span>
          </span>
        ))}
      </div>
    </div>
  );
}
