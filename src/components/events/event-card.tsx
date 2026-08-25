import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventPoster } from "@/components/events/event-poster";
import { cn, formatEventDateTime } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { EventRow } from "@/types/database";

export async function EventCard({
  event,
  variant = "default",
}: {
  event: EventRow;
  /** "muted" は過去イベント一覧など、目立たせたくない場所で使う控えめな見た目。 */
  variant?: "default" | "muted";
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const title = (locale === "en" && event.title_en) || event.title;
  const categoryLabel = dict.categories[event.category] ?? event.category;
  const isMuted = variant === "muted";

  return (
    <Link href={`/events/${event.id}`} className="group block">
      <Card
        className={cn(
          "h-full overflow-hidden transition-all duration-200",
          isMuted
            ? "opacity-70 grayscale-[0.35] hover:opacity-100 hover:grayscale-0"
            : "group-hover:-translate-y-0.5 group-hover:border-foreground/15 group-hover:shadow-card-hover"
        )}
      >
        <EventPoster
          src={event.poster_url}
          alt={title}
          emptyLabel={dict.event.noImage}
          className={cn(
            !isMuted && "[&_img]:transition-transform [&_img]:duration-300 group-hover:[&_img]:scale-[1.03]"
          )}
        />
        <CardContent className={cn("flex flex-col gap-2", isMuted ? "p-3" : "p-3.5")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{categoryLabel}</Badge>
            {event.target_floors && event.target_floors.length > 0 && (
              <Badge variant="outline">
                {event.target_floors.map((f) => `${f}${dict.event.floorUnit}`).join("・")}
                {dict.event.limitedFloors}
              </Badge>
            )}
            {!!event.fee_amount && (
              <Badge variant="outline" className="border-primary/25 text-primary">
                {dict.event.feePrefix}
                {event.fee_amount.toLocaleString()}
                {dict.event.feeUnit}
              </Badge>
            )}
          </div>
          <h3
            className={cn(
              "line-clamp-2 font-semibold leading-snug transition-colors group-hover:text-primary",
              isMuted && "text-sm"
            )}
          >
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatEventDateTime(event.event_date, locale)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
