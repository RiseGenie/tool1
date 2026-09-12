import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { CheckIcon } from "@/components/icons/icons";
import { Badge } from "@/components/ui/Badge";

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    tag: null,
    features: ["Up to 50 members", "Discussion feed", "1 course", "Basic gamification"],
  },
  {
    name: "Growth",
    price: "$79",
    period: "/month",
    tag: "Most popular",
    features: [
      "Unlimited members",
      "Unlimited courses",
      "Live events & calendar",
      "Full gamification suite",
      "Custom branding",
    ],
  },
  {
    name: "Scale",
    price: "$249",
    period: "/month",
    tag: null,
    features: [
      "Everything in Growth",
      "Multiple communities",
      "Advanced analytics",
      "API access",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto mt-32 w-full max-w-6xl px-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Simple pricing that scales with you.
        </h2>
        <p className="mt-4 text-white/65">
          Start free. Upgrade when your community starts paying for itself.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <GlassCard
            key={p.name}
            className={
              p.tag
                ? "relative flex flex-col p-8 ring-2 ring-[color-mix(in_srgb,var(--c-orange)_60%,transparent)] scale-[1.02]"
                : "relative flex flex-col p-8"
            }
          >
            {p.tag && (
              <Badge tone="orange" className="absolute -top-3 left-1/2 -translate-x-1/2">
                {p.tag}
              </Badge>
            )}
            <h3 className="text-lg font-bold text-white">{p.name}</h3>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-white">{p.price}</span>
              <span className="pb-1 text-sm text-white/50">{p.period}</span>
            </div>
            <ul className="mt-6 flex flex-1 flex-col gap-3">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/75">
                  <CheckIcon size={26} floaty={false} />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              href="/dashboard"
              variant={p.tag ? "primary" : "glass"}
              className="mt-8 w-full"
            >
              Get started
            </Button>
          </GlassCard>
        ))}
      </div>
    </section>
  );
}
