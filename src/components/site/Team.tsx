"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { TEAM } from "@/lib/data";
import { Reveal, SectionHead } from "./ui";

function Member({ m }: { m: (typeof TEAM)[number] }) {
  const [flip, setFlip] = useState(false);
  return (
    <button
      onClick={() => setFlip((f) => !f)} aria-pressed={flip}
      aria-label={`${m.name}, ${m.role}. ${flip ? "Show portrait" : "Read bio"}`}
      className="scene block h-[440px] w-full text-left"
    >
      <motion.div className="relative h-full w-full" style={{ transformStyle: "preserve-3d" }} animate={{ rotateY: flip ? 180 : 0 }} transition={{ type: "spring", stiffness: 120, damping: 16 }}>
        <div className="brut absolute inset-0 flex flex-col justify-between overflow-hidden p-6" style={{ background: m.color, backfaceVisibility: "hidden" }}>
          <div className="spin-slow absolute -right-10 -top-10 h-40 w-40 border-[3px] border-ink bg-yellow" aria-hidden />
          <div className="relative grid h-44 w-44 place-items-center border-[3px] border-ink bg-white text-7xl font-bold shadow-[6px_6px_0_var(--ink)]">{m.initials}</div>
          <div className="relative">
            <h3 className="text-4xl font-bold leading-none">{m.name}</h3>
            <p className="mt-2 font-mono font-bold uppercase">{m.role}</p>
            <p className="mt-4 font-bold">Tap to read bio ↻</p>
          </div>
        </div>
        <div className="brut absolute inset-0 flex flex-col justify-between overflow-auto bg-ink p-6 text-paper" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <p className="font-medium leading-snug">{m.bio}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {m.skills.map((s) => <li key={s} className="border-2 border-paper px-2 py-1 font-mono text-xs font-bold uppercase" style={{ color: m.color }}>{s}</li>)}
          </ul>
        </div>
      </motion.div>
    </button>
  );
}

export default function Team() {
  return (
    <section id="team" className="border-b-[3px] border-ink bg-green py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead kicker="Our team" color="var(--paper)" sub="The passionate experts behind RiseGenie's success, dedicated to transforming your business growth.">
          Meet the visionaries
        </SectionHead>
        <div className="grid gap-8 md:grid-cols-2">
          {TEAM.map((m, i) => <Reveal key={m.name} delay={i * 0.1}><Member m={m} /></Reveal>)}
        </div>
        <p className="mt-10 inline-block -rotate-1 border-[3px] border-ink bg-yellow px-4 py-2 font-bold uppercase shadow-[4px_4px_0_var(--ink)]">★ Award-winning team with proven industry expertise</p>
      </div>
    </section>
  );
}
