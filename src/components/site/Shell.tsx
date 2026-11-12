"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CONTACT } from "@/lib/data";
import { DemoContext } from "./ui";

function DemoModal({ onClose }: { onClose: () => void }) {
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = `Demo request\nName: ${f.get("name")}\nPhone: ${f.get("phone")}\nEmail: ${f.get("email")}\nPreferred time: ${f.get("when")}`;
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Free 15-minute demo request")}&body=${encodeURIComponent(body)}`;
    onClose();
  }
  const f = "mt-1 w-full border-[3px] border-ink bg-white px-3 py-2 font-medium";
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-ink/70 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog" aria-modal="true" aria-labelledby="demo-title"
        initial={{ y: 60, rotate: -3, scale: 0.9 }} animate={{ y: 0, rotate: 0, scale: 1 }} exit={{ y: 60, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        onClick={(e) => e.stopPropagation()} className="brut max-h-[92vh] w-full max-w-md overflow-auto bg-green p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="demo-title" className="text-3xl font-bold leading-none">Book a free 15-minute demo</h2>
            <p className="mt-2 font-mono text-sm font-bold">with Chandan Mitra · CEO @ RiseGenie LLC</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="brut-sm grid h-10 w-10 shrink-0 place-items-center bg-white text-xl font-bold">×</button>
        </div>
        <p className="mt-3 font-medium">Explore business automation, lead follow-up, and workflows for your business.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm font-bold uppercase">Name<input ref={first} name="name" required className={f} /></label>
          <label className="block text-sm font-bold uppercase">Email<input name="email" type="email" required className={f} /></label>
          <label className="block text-sm font-bold uppercase">Phone<input name="phone" type="tel" required className={f} /></label>
          <label className="block text-sm font-bold uppercase">Preferred time (MST)
            <select name="when" className={f}><option>Weekday morning</option><option>Weekday afternoon</option><option>Saturday</option></select></label>
          <button className="btn w-full bg-ink !text-paper" type="submit">Request my demo →</button>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  return (
    <DemoContext.Provider value={{ open: show }}>
      {children}
      <button onClick={show} className="btn fixed bottom-4 right-4 z-40 !px-4 !py-3 text-sm sm:bottom-6 sm:right-6" aria-label="Book a free demo">
        <span className="wiggle" aria-hidden>✺</span> Free demo
      </button>
      <AnimatePresence>{open && <DemoModal onClose={hide} />}</AnimatePresence>
    </DemoContext.Provider>
  );
}
