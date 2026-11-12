"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

type DemoCtx = { open: () => void };
export const DemoContext = createContext<DemoCtx>({ open: () => {} });
export const useDemo = () => useContext(DemoContext);

/** Slides + fades children in when scrolled into view. */
export function Reveal({
  children, delay = 0, y = 40, className = "", rotate = 0,
}: { children: ReactNode; delay?: number; y?: number; className?: string; rotate?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y, rotate }}
      whileInView={{ opacity: 1, y: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ type: "spring", stiffness: 140, damping: 18, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `to` when visible. */
export function Counter({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / (reduce ? 1 : 1400), 1);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, reduce]);
  return <span ref={ref}>{val.toFixed(decimals)}{suffix}</span>;
}

export function SectionHead({ kicker, children, sub, color = "var(--yellow)" }: { kicker: string; children: ReactNode; sub?: string; color?: string }) {
  return (
    <Reveal className="mb-12 max-w-3xl">
      <span className="brut-sm inline-block px-3 py-1 font-mono text-sm font-bold uppercase" style={{ background: color }}>
        {kicker}
      </span>
      <h2 className="mt-5 text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">{children}</h2>
      {sub && <p className="mt-5 max-w-xl text-lg font-medium">{sub}</p>}
    </Reveal>
  );
}
