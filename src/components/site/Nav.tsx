"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { NAV } from "@/lib/data";
import { useDemo } from "./ui";

export default function Nav() {
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);
  const { open: book } = useDemo();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });

  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-[3px] border-ink bg-paper">
      <motion.div style={{ scaleX: progress }} className="absolute inset-x-0 bottom-0 h-1.5 origin-left bg-green" aria-hidden />
      <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <a href="#top" className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="brut-sm wiggle grid h-10 w-10 place-items-center bg-green text-xl">R</span>
          RiseGenie
        </a>
        <ul className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <li key={n.id}>
              <a
                href={`#${n.id}`}
                aria-current={active === n.id ? "true" : undefined}
                className={`border-2 px-3 py-1.5 text-sm font-bold uppercase transition-colors ${active === n.id ? "border-ink bg-yellow" : "border-transparent hover:border-ink hover:bg-white"}`}
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <button className="btn hidden !px-4 !py-2 text-sm sm:inline-flex" onClick={book}>Book a demo</button>
          <button
            className="brut-sm grid h-11 w-11 place-items-center bg-yellow lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <span className="block w-5 space-y-1.5">
              <span className={`block h-[3px] bg-ink transition-transform ${open ? "translate-y-[9px] rotate-45" : ""}`} />
              <span className={`block h-[3px] bg-ink transition-opacity ${open ? "opacity-0" : ""}`} />
              <span className={`block h-[3px] bg-ink transition-transform ${open ? "-translate-y-[9px] -rotate-45" : ""}`} />
            </span>
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-t-[3px] border-ink bg-yellow lg:hidden"
          >
            <ul className="grid gap-2 p-4">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} onClick={() => setOpen(false)} className="brut-sm block bg-white px-4 py-3 text-xl font-bold uppercase">{n.label}</a>
                </li>
              ))}
              <li><button className="btn w-full" onClick={() => { setOpen(false); book(); }}>Book a free demo</button></li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
