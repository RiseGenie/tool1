"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CATEGORIES, SERVICES, type Category } from "@/lib/data";
import { SectionHead, useDemo } from "./ui";

function Card({ s, i }: { s: (typeof SERVICES)[number]; i: number }) {
  const { open } = useDemo();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 10 });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      className="brut group flex flex-col p-6 transition-[box-shadow] hover:shadow-[10px_10px_0_var(--ink)]"
    >
      <div className="flex items-start justify-between">
        <span className="brut-sm grid h-14 w-14 place-items-center text-3xl font-bold transition-transform group-hover:rotate-12 group-hover:scale-110" style={{ background: s.color }} aria-hidden>{s.icon}</span>
        <span className="font-mono text-sm font-bold">{String(i + 1).padStart(2, "0")}</span>
      </div>
      <h3 className="mt-5 text-2xl font-bold leading-tight">{s.title}</h3>
      <p className="mt-2 flex-1 font-medium">{s.blurb}</p>
      <button onClick={open} className="mt-5 inline-flex items-center gap-2 self-start border-b-[3px] border-ink font-bold uppercase hover:bg-yellow">
        {s.cta} <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
      </button>
    </motion.article>
  );
}

export default function Services() {
  const [cat, setCat] = useState<"all" | Category>("all");
  const list = SERVICES.map((s, i) => ({ s, i })).filter(({ s }) => cat === "all" || s.cat === cat);
  return (
    <section id="services" className="border-b-[3px] border-ink bg-yellow/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead kicker="Our services" sub="Comprehensive digital marketing services designed to elevate your brand and accelerate your business growth.">
          Explore our <span className="underline decoration-green decoration-[10px] underline-offset-4">solutions</span>
        </SectionHead>

        <div role="group" aria-label="Filter services" className="mb-8 flex flex-wrap gap-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id}
              className={`brut-sm px-4 py-2 font-bold uppercase transition-transform hover:-translate-y-0.5 ${cat === c.id ? "bg-ink text-green" : "bg-white"}`}
            >
              {c.label}
              <span className="ml-2 font-mono text-xs">{c.id === "all" ? SERVICES.length : SERVICES.filter((s) => s.cat === c.id).length}</span>
            </button>
          ))}
        </div>

        <LayoutGroup>
          <motion.div layout className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map(({ s, i }) => <Card key={s.title} s={s} i={i} />)}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>

        <div className="brut mt-12 flex flex-col items-start justify-between gap-6 bg-green p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-3xl font-bold sm:text-4xl">Need multiple services or a custom solution?</h3>
            <p className="mt-1 font-medium">Let&apos;s discuss your unique business needs and create a tailored strategy for your success.</p>
          </div>
          <a href="#contact" className="btn shrink-0 bg-ink !text-paper">Contact us today →</a>
        </div>
      </div>
    </section>
  );
}
