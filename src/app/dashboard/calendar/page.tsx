import { Topbar } from "@/components/app/Topbar";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CalendarIcon } from "@/components/icons/icons";
import { events } from "@/lib/mock-data";

export default function CalendarPage() {
  return (
    <>
      <Topbar title="Events" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {events.map((event) => (
          <GlassCard key={event.id} className="flex items-start gap-4 p-5">
            <CalendarIcon size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">{event.title}</h3>
                <Badge tone={event.tone}>{event.attendees} going</Badge>
              </div>
              <p className="mt-1 text-xs text-white/55">
                {event.date} · {event.time}
              </p>
              <p className="mt-1 text-xs text-white/45">Hosted by {event.host}</p>
              <Button size="sm" variant="glass" className="mt-3">
                RSVP
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
