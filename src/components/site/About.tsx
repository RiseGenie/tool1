"use client";

import { useState } from "react";
import { PILLARS } from "@/lib/data";
import { Reveal, SectionHead } from "./ui";

// Rotations that bring each of the cube's four side faces to the front.
const FACE = [0, -90, -180, -270];
const SIZE = 260;

export default function About() {
  const [i, setI] = useState(0);
  const next = (d: number) => setI((v) => (v + d + 4) % 4);

  return (
    <section id="about" className="border-b-[3px] border-ink py-20 sm:py-28 dots">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <SectionHead kicker="About us" color="var(--pink)">Empower your business with <span className="bg-green px-2">RiseGenie</span></SectionHead>
          <Reveal>
            <p className="max-w-xl text-lg font-medium">At RiseGenie Marketing Solutions, we specialize in delivering a full spectrum of digital marketing services tailored to your unique business needs. Our mission is to help you achieve your marketing goals with innovative strategies and exceptional execution.</p>
            <p className="mt-4 max-w-xl text-lg font-medium">From business automation to brand elevation, we combine cutting-edge technology with proven marketing expertise to drive sustainable growth for coaches, consultants, and businesses of all sizes.</p>
          </Reveal>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {PILLARS.map((p, k) => (
              <li key={p.title}>
                <button
                  onClick={() => setI(k)} aria-pressed={i === k}
                  className={`brut-sm w-full p-4 text-left transition-transform hover:-translate-y-1 ${i === k ? "translate-x-1 translate-y-1 !shadow-none" : ""}`}
                  style={{ background: i === k ? p.color : "#fff" }}
                >
                  <span className="font-mono text-xs font-bold">0{k + 1}</span>
                  <span className="block text-lg font-bold">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col items-center gap-8">
          <div className="scene" style={{ width: SIZE, height: SIZE }}>
            <div className="cube relative h-full w-full" style={{ transform: `translateZ(-${SIZE / 2}px) rotateX(-14deg) rotateY(${FACE[i] - 28}deg)` }}>
              {PILLARS.map((p, k) => (
                <div
                  key={p.title}
                  className="cube-face flex flex-col justify-between border-[3px] border-ink p-5"
                  style={{ background: p.color, transform: `rotateY(${k * 90}deg) translateZ(${SIZE / 2}px)` }}
                  aria-hidden={i !== k}
                >
                  <span className="font-mono text-sm font-bold">0{k + 1} / 04</span>
                  <div><h3 className="text-2xl font-bold leading-tight">{p.title}</h3><p className="mt-2 text-sm font-medium">{p.body}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <button className="btn bg-white" onClick={() => next(-1)} aria-label="Previous pillar">←</button>
            <button className="btn bg-yellow" onClick={() => next(1)} aria-label="Next pillar">→</button>
          </div>
        </div>
      </div>
    </section>
  );
}
