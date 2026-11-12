"use client";

import { useState } from "react";
import { CONTACT } from "@/lib/data";
import { SectionHead } from "./ui";

const HOURS = [["Monday – Friday", "9:00 AM – 6:00 PM MST"], ["Saturday", "10:00 AM – 4:00 PM MST"], ["Sunday", "Closed"]];

const input = "w-full border-[3px] border-ink bg-white px-4 py-3 font-medium shadow-[4px_4px_0_var(--ink)] focus:bg-yellow/30";

export default function Contact() {
  const [sent, setSent] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = `Name: ${f.get("name")}\nPhone: ${f.get("phone")}\nEmail: ${f.get("email")}\n\n${f.get("message") ?? ""}`;
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent("Website enquiry from " + f.get("name"))}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <section id="contact" className="border-b-[3px] border-ink bg-yellow py-20 sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <SectionHead kicker="Get in touch" color="var(--green)" sub="Let's discuss how RiseGenie can help you achieve your marketing goals and drive sustainable growth.">
            Ready to transform your business?
          </SectionHead>
          {sent ? (
            <div className="brut bg-green p-8" role="status">
              <p className="text-4xl font-bold">Thanks — almost there! ✺</p>
              <p className="mt-2 font-medium">Your email app should have opened with your message ready to send. If not, write to <a className="underline" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> or call {CONTACT.phone}.</p>
              <button className="btn mt-6 bg-white" onClick={() => setSent(false)}>Send another</button>
            </div>
          ) : (
            <form onSubmit={submit} className="brut grid gap-5 p-6 sm:p-8">
              <label className="block font-bold uppercase">Full name *<input name="name" required autoComplete="name" className={`${input} mt-2`} /></label>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block font-bold uppercase">Email *<input name="email" type="email" required autoComplete="email" className={`${input} mt-2`} /></label>
                <label className="block font-bold uppercase">Phone *<input name="phone" type="tel" required autoComplete="tel" className={`${input} mt-2`} /></label>
              </div>
              <label className="block font-bold uppercase">Message<textarea name="message" rows={4} placeholder="Write your message here" className={`${input} mt-2`} /></label>
              <button className="btn text-lg" type="submit">Send message →</button>
            </form>
          )}
        </div>

        <aside className="space-y-6 lg:pt-32">
          <div className="brut p-6">
            <h3 className="text-3xl font-bold">Let&apos;s connect</h3>
            <p className="mt-2 font-medium">Whether you need help with a specific service or want to explore comprehensive marketing solutions, we&apos;re here to help.</p>
            <dl className="mt-5 space-y-3 font-mono font-bold">
              <div><dt className="text-xs uppercase opacity-60">Email</dt><dd><a className="underline decoration-green decoration-4" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></dd></div>
              <div><dt className="text-xs uppercase opacity-60">Phone</dt><dd><a className="underline decoration-green decoration-4" href={`tel:${CONTACT.phone.replace(/[^+\d]/g, "")}`}>{CONTACT.phone}</a></dd></div>
              <div><dt className="text-xs uppercase opacity-60">Office</dt><dd>{CONTACT.address}</dd></div>
            </dl>
          </div>
          <div className="brut bg-ink p-6 text-paper">
            <h3 className="text-2xl font-bold">Business hours</h3>
            <ul className="mt-3 space-y-2 font-mono text-sm">
              {HOURS.map(([d, h]) => <li key={d} className="flex justify-between gap-4 border-b-2 border-dashed border-paper/40 pb-2"><span>{d}</span><span className="text-green">{h}</span></li>)}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}
