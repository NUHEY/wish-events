import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEventDateTime } from "@/lib/utils";
import type { EventRow } from "@/types/database";

export function EventCard({ event }: { event: EventRow }) {
  return (
    <Link href={`/events/${event.id}`} className="group block">
      <Card className="h-full overflow-hidden transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/15 group-hover:shadow-card-hover">
        <div className="relative aspect-[4/3] w-full bg-muted">
          {event.poster_url ? (
            <Image
              src={event.poster_url}
              alt={event.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No Image
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-2 p-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{event.category}</Badge>
            {event.target_floors && event.target_floors.length > 0 && (
              <Badge variant="outline">
                {event.target_floors.map((f) => `${f}階`).join("・")}限定
              </Badge>
            )}
          </div>
          <h3 className="line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary">
            {event.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatEventDateTime(event.event_date)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
