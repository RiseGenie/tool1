import { TOOLS } from "@/lib/data";
import { Reveal, SectionHead } from "./ui";

export default function Tools() {
  return (
    <section id="tools" className="border-b-[3px] border-ink py-20 sm:py-28 dots">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead kicker="Free tools" color="var(--blue)">Try before you buy</SectionHead>
        <div className="grid gap-6 md:grid-cols-3">
          {TOOLS.map((t, i) => (
            <Reveal key={t.title} delay={i * 0.08}>
              <a href={t.href} target="_blank" rel="noopener noreferrer" className="brut group block h-full p-6 transition-all hover:-translate-y-2 hover:rotate-1 hover:shadow-[10px_10px_0_var(--ink)]" style={{ background: t.color }}>
                <span className="font-mono text-sm font-bold">FREE · 0{i + 1}</span>
                <h3 className="mt-6 text-3xl font-bold">{t.title}</h3>
                <p className="mt-2 font-medium">{t.body}</p>
                <span className="mt-6 inline-block border-[3px] border-ink bg-white px-3 py-1 font-bold uppercase transition-transform group-hover:translate-x-2">Open tool ↗</span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
