"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { SectionHead } from "./ui";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Slider({ label, value, set, min, max, step, show }: { label: string; value: number; set: (n: number) => void; min: number; max: number; step: number; show: string }) {
  return (
    <label className="block">
      <span className="flex justify-between font-bold uppercase"><span>{label}</span><span className="font-mono">{show}</span></span>
      <input
        type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)}
        className="mt-2 h-4 w-full cursor-pointer appearance-none border-[3px] border-ink bg-white accent-ink"
      />
    </label>
  );
}

export default function RoiCalc() {
  const [spend, setSpend] = useState(3000);
  const [cpl, setCpl] = useState(25);
  const [close, setClose] = useState(15);
  const [deal, setDeal] = useState(1500);

  const leads = spend / cpl;
  const clients = leads * (close / 100);
  const revenue = clients * deal;
  const roi = spend ? ((revenue - spend) / spend) * 100 : 0;
  const good = roi >= 0;

  return (
    <section className="border-b-[3px] border-ink bg-blue py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHead kicker="Play with the numbers" color="var(--green)" sub="A quick back-of-the-napkin ad ROI estimate. For a deeper look, try our free Ad ROI Calculator.">
          What could your ads return?
        </SectionHead>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="brut space-y-6 p-6 sm:p-8">
            <Slider label="Monthly ad spend" value={spend} set={setSpend} min={500} max={20000} step={100} show={fmt(spend)} />
            <Slider label="Cost per lead" value={cpl} set={setCpl} min={5} max={150} step={1} show={fmt(cpl)} />
            <Slider label="Lead → client rate" value={close} set={setClose} min={1} max={50} step={1} show={`${close}%`} />
            <Slider label="Avg. deal value" value={deal} set={setDeal} min={100} max={10000} step={50} show={fmt(deal)} />
          </div>
          <div className="brut flex flex-col justify-between bg-ink p-6 text-paper sm:p-8" aria-live="polite">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-[3px] border-paper p-4"><p className="font-mono text-sm uppercase">Leads / mo</p><p className="text-4xl font-bold">{Math.round(leads)}</p></div>
              <div className="border-[3px] border-paper p-4"><p className="font-mono text-sm uppercase">New clients</p><p className="text-4xl font-bold">{clients.toFixed(1)}</p></div>
            </div>
            <div className="my-6">
              <p className="font-mono text-sm uppercase">Estimated revenue</p>
              <motion.p key={Math.round(revenue)} initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="text-6xl font-bold text-green sm:text-7xl">{fmt(revenue)}</motion.p>
            </div>
            <div className="h-6 border-[3px] border-paper bg-paper/10" role="img" aria-label={`ROI ${Math.round(roi)} percent`}>
              <motion.div className="h-full" style={{ background: good ? "var(--green)" : "var(--orange)" }} animate={{ width: `${Math.min(Math.max(roi, 0) / 8, 100)}%` }} />
            </div>
            <p className="mt-3 text-2xl font-bold">{good ? "ROI" : "Net"}: <span className={good ? "text-green" : "text-orange"}>{Math.round(roi)}%</span></p>
            <p className="mt-2 font-mono text-xs opacity-70">Illustrative estimate only — not a guarantee of results.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
