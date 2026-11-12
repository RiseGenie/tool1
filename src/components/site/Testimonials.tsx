"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TESTIMONIALS } from "@/lib/data";
import { SectionHead } from "./ui";

export default function Testimonials() {
  const [[i, dir], set] = useState<[number, number]>([0, 1]);
  const go = (d: number) => set([(i + d + TESTIMONIALS.length) % TESTIMONIALS.length, d]);
  const t = TESTIMONIALS[i];

  return (
    <section id="testimonials" className="overflow-hidden border-b-[3px] border-ink bg-pink py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead kicker="Testimonials" color="var(--yellow)" sub="Real results from real businesses. Discover how we've helped our clients achieve extraordinary growth.">
          What our clients say
        </SectionHead>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="relative min-h-[360px]" aria-live="polite">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.figure
                key={i} custom={dir}
                initial={{ x: dir * 80, opacity: 0, rotate: dir * 2 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ x: dir * -80, opacity: 0, rotate: dir * -2 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
                className="brut flex h-full min-h-[360px] flex-col justify-between p-6 sm:p-10" style={{ background: t.color }}
              >
                <div>
                  <div className="text-2xl" aria-label="5 out of 5 stars">★★★★★</div>
                  <blockquote className="mt-4 text-xl font-medium leading-snug sm:text-2xl">&ldquo;{t.quote}&rdquo;</blockquote>
                </div>
                <figcaption className="mt-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xl font-bold">{t.name}</p>
                    <p className="font-mono text-sm">{t.role}</p>
                  </div>
                  <span className="brut-sm -rotate-3 bg-ink px-3 py-2 font-mono text-sm font-bold uppercase text-green">{t.stat}</span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-3">
            {TESTIMONIALS.map((x, k) => (
              <button key={x.name} onClick={() => set([k, k > i ? 1 : -1])} aria-pressed={k === i}
                className={`brut-sm flex items-center gap-3 p-3 text-left transition-transform hover:-translate-y-0.5 ${k === i ? "bg-ink text-paper" : "bg-white"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-ink font-bold text-ink" style={{ background: x.color }}>{x.name[0]}</span>
                <span><span className="block font-bold leading-tight">{x.name}</span><span className="font-mono text-xs">{x.role}</span></span>
              </button>
            ))}
            <div className="mt-2 flex gap-3">
              <button className="btn flex-1 bg-white" onClick={() => go(-1)} aria-label="Previous testimonial">←</button>
              <button className="btn flex-1 bg-yellow" onClick={() => go(1)} aria-label="Next testimonial">→</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
