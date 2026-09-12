import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { RocketIcon } from "@/components/icons/icons";

export function CTA() {
  return (
    <section className="mx-auto mt-32 w-full max-w-5xl px-4">
      <GlassCard className="flex flex-col items-center gap-6 overflow-hidden p-10 text-center sm:p-16">
        <RocketIcon size={72} />
        <h2 className="max-w-lg text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Your community is waiting to be built.
        </h2>
        <p className="max-w-md text-white/65">
          Join thousands of creators using Orbit Circle to turn followers into
          a thriving, paying community.
        </p>
        <Button href="/dashboard" size="lg">
          Start your community free
        </Button>
      </GlassCard>
    </section>
  );
}
