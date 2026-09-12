"use client";

import { Button } from "@/components/ui/Button";
import { CommunityIcon } from "@/components/icons/icons";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#testimonials", label: "Stories" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-4 z-50 mx-auto w-full max-w-6xl px-4">
      <nav className="glass glass-panel flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <CommunityIcon size={38} floaty={false} />
          <span className="text-lg font-bold tracking-tight text-white">
            Orbit <span className="text-shimmer">Circle</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button href="/dashboard" variant="ghost" size="sm">
            Log in
          </Button>
          <Button href="/dashboard" variant="primary" size="sm">
            Start free
          </Button>
        </div>

        <button
          className="grid h-10 w-10 place-items-center rounded-full text-white/80 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="glass glass-panel mt-2 flex flex-col gap-1 p-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-2 flex gap-2">
            <Button href="/dashboard" variant="glass" size="sm" className="flex-1">
              Log in
            </Button>
            <Button href="/dashboard" variant="primary" size="sm" className="flex-1">
              Start free
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
