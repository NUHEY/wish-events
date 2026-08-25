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
        <div className="relative">
          <EventPoster
            src={event.poster_url}
            alt={title}
            emptyLabel={dict.event.noImage}
            ratioClassName="aspect-[4/3] sm:aspect-[4/5]"
            className={cn(!isMuted && "[&_img]:transition-transform [&_img]:duration-300 group-hover:[&_img]:scale-[1.03]")}
          />
          <Badge variant="secondary" className="absolute left-2 top-2 bg-card/95 shadow-sm backdrop-blur">{categoryLabel}</Badge>
          {!!event.fee_amount && <span className="absolute bottom-2 right-2 rounded-full bg-foreground/85 px-2 py-1 text-[10px] font-semibold text-background shadow-sm">{dict.event.feePrefix}{event.fee_amount.toLocaleString()}{dict.event.feeUnit}</span>}
        </div>
        <CardContent className={cn("flex h-[104px] flex-col justify-between gap-1.5 p-2.5 sm:h-[122px] sm:gap-2 sm:p-3.5", isMuted && "p-2.5 sm:p-3")}>
          <h3
            className={cn(
              "line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary sm:text-base",
              isMuted && "text-sm"
            )}
          >
            {title}
          </h3>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {formatEventDateTime(event.event_date, locale)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
