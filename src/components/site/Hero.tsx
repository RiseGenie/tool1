"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { Counter, useDemo } from "./ui";

const HeroScene = dynamic(() => import("./HeroScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center font-mono font-bold">Loading 3D…</div>,
});

const STATS = [
  { to: 100, suffix: "+", label: "Happy clients", sub: "Across the globe", color: "var(--yellow)" },
  { to: 1, suffix: "M+", label: "Revenue generated", sub: "For our clients", color: "var(--pink)" },
  { to: 4.8, decimals: 1, suffix: "/5", label: "Rating received", sub: "From our clients", color: "var(--blue)" },
];

export default function Hero() {
  const { open } = useDemo();
  const reduce = useReducedMotion();
  const line = (d: number) => ({
    initial: reduce ? false : { y: "110%" },
    animate: { y: 0 },
    transition: { type: "spring" as const, stiffness: 120, damping: 16, delay: d },
  });

  return (
    <section id="top" className="dots relative overflow-hidden border-b-[3px] border-ink pt-[72px]">
      <div className="mx-auto grid max-w-7xl items-center gap-4 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <div>
          <motion.span
            initial={reduce ? false : { scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: -2 }}
            className="brut-sm inline-block bg-green px-3 py-1 font-mono text-sm font-bold uppercase"
          >
            Comprehensive digital marketing solutions
          </motion.span>
          <h1 className="mt-6 text-[clamp(3rem,6.6vw,6.2rem)] font-bold leading-[0.88] tracking-tighter">
            <span className="block overflow-hidden pb-1"><motion.span className="block" {...line(0.1)}>Powering</motion.span></span>
            <span className="block overflow-hidden pb-1">
              <motion.span className="block" {...line(0.2)}>
                your <span className="inline-block -rotate-2 border-[3px] border-ink bg-green px-3 shadow-[6px_6px_0_var(--ink)]">growth</span>
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-2"><motion.span className="block" {...line(0.3)}>Simplifying success</motion.span></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium sm:text-xl">
            We deliver tailored digital marketing strategies that turn your business vision into measurable results. From automation to brand elevation, we&apos;ve got you covered.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <button className="btn text-lg" onClick={open}>Start your journey <span aria-hidden>→</span></button>
            <a href="#services" className="btn bg-white text-lg">Explore services <span aria-hidden>↓</span></a>
          </div>
        </div>

        <div className="brut relative h-[420px] bg-blue sm:h-[500px] lg:h-[560px]">
          <HeroScene />
          <span className="brut-sm floaty absolute left-4 top-4 bg-yellow px-3 py-1 font-mono text-xs font-bold uppercase" style={{ "--r": "-3deg" } as React.CSSProperties}>
            Move your mouse · click a bar
          </span>
          <span className="brut-sm absolute bottom-4 right-4 bg-white px-3 py-1 font-mono text-xs font-bold uppercase">Revenue ↗</span>
        </div>
      </div>

      <dl className="mx-auto grid max-w-7xl gap-4 px-4 pb-12 sm:grid-cols-3 sm:px-6">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={reduce ? false : { opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }}
            whileHover={{ y: -6, rotate: i % 2 ? 1 : -1 }}
            className="brut p-5" style={{ background: s.color }}
          >
            <dd className="text-5xl font-bold tracking-tight sm:text-6xl"><Counter to={s.to} decimals={s.decimals} suffix={s.suffix} /></dd>
            <dt className="mt-1 font-bold uppercase">{s.label}</dt>
            <p className="font-mono text-sm">{s.sub}</p>
          </motion.div>
        ))}
      </dl>
    </section>
  );
}
