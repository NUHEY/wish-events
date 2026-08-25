import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventPoster } from "@/components/events/event-poster";
import { cn, formatEventDateTime } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { EventCardData } from "@/types/database";

export type EventCardFriend = { id: string; full_name: string | null; avatar_url: string | null };

const FRIEND_AVATAR_MAX_VISIBLE = 4;

/** カード左下に、参加している友達のアイコンを少し重ねて表示する（ホームの「友達が参加するイベント」用）。 */
function FriendAvatarStack({ friends }: { friends: EventCardFriend[] }) {
  const visible = friends.slice(0, FRIEND_AVATAR_MAX_VISIBLE);
  const overflow = friends.length - visible.length;
  return (
    <div className="absolute bottom-2 left-2 flex items-center -space-x-2">
      {visible.map((f) => (
        <span key={f.id} className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-secondary text-[8px] font-semibold text-secondary-foreground ring-2 ring-card">
          {f.avatar_url ? (
            <Image src={f.avatar_url} alt="" width={20} height={20} className="h-full w-full object-cover" />
          ) : (
            f.full_name?.charAt(0) ?? "?"
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[7px] font-semibold text-muted-foreground ring-2 ring-card">
          +{overflow}
        </span>
      )}
    </div>
  );
}

export async function EventCard({
  event,
  variant = "default",
  attendingFriends,
}: {
  event: EventCardData;
  /** "muted" は過去イベント一覧など、目立たせたくない場所で使う控えめな見た目。 */
  variant?: "default" | "muted";
  /** 指定すると、カード左下に参加している友達のアイコンを重ねて表示する。 */
  attendingFriends?: EventCardFriend[];
}) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const title = (locale === "en" && event.title_en) || event.title;
  const categoryLabel = dict.categories[event.category] ?? event.category;
  const isMuted = variant === "muted";

  // 自動タグ: 登録から1週間以内は「新規」、締切が近い（48時間以内）場合は「締切間近」。
  const now = Date.now();
  const isNew = !isMuted && now - new Date(event.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  const closesAt = event.registration_closes_at ? new Date(event.registration_closes_at).getTime() : null;
  const isDeadlineSoon =
    !isMuted && closesAt != null && closesAt > now && closesAt - now < 48 * 60 * 60 * 1000;

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
            ratioClassName="aspect-[4/3]"
            className={cn(!isMuted && "[&_img]:transition-transform [&_img]:duration-300 group-hover:[&_img]:scale-[1.03]")}
          />
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            <Badge variant="secondary" className="bg-card/95 shadow-sm backdrop-blur">{categoryLabel}</Badge>
            {isNew && <Badge variant="default" className="border-0 bg-sky-600/90 shadow-sm">{dict.event.newTag}</Badge>}
            {isDeadlineSoon && <Badge variant="destructive" className="border-0 shadow-sm">{dict.event.deadlineSoonTag}</Badge>}
          </div>
          {event.fee_amount ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-foreground/85 px-2 py-1 text-[10px] font-semibold text-background shadow-sm">{dict.event.feePrefix}{event.fee_amount.toLocaleString()}{dict.event.feeUnit}</span>
          ) : (
            <span className="absolute bottom-2 right-2 rounded-full bg-emerald-600/90 px-2 py-1 text-[10px] font-semibold text-background shadow-sm">{dict.event.freeLabel}</span>
          )}
          {attendingFriends && attendingFriends.length > 0 && <FriendAvatarStack friends={attendingFriends} />}
        </div>
        <CardContent className={cn("flex min-h-[76px] flex-col justify-between gap-1.5 p-2.5 sm:min-h-[88px] sm:gap-2 sm:p-3.5", isMuted && "p-2.5 sm:p-3")}>
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
