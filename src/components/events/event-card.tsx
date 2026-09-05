import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EventPoster } from "@/components/events/event-poster";
import { EventLabelRotator, type EventCardLabel } from "@/components/events/event-label-rotator";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { cn, formatEventDateTime } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getSiteSettings } from "@/lib/site-settings";
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
          <Image src={f.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={20} height={20} className="h-full w-full object-cover" />
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
  labelRotationMs,
}: {
  event: EventCardData;
  /** "muted" は過去イベント一覧など、目立たせたくない場所で使う控えめな見た目。 */
  variant?: "default" | "muted";
  /** 指定すると、カード左下に参加している友達のアイコンを重ねて表示する。 */
  attendingFriends?: EventCardFriend[];
  /** ラベルの切り替え間隔。省略時はRAのイベント表示設定を使う。 */
  labelRotationMs?: number;
}) {
  const [locale, settings] = await Promise.all([getLocale(), getSiteSettings()]);
  const dict = getDictionary(locale);
  const title = (locale === "en" && event.title_en) || event.title;
  const categoryLabel = dict.categories[event.category] ?? event.category;
  const isMuted = variant === "muted";
  const isResidentEvent = event.creator_type === "resident";

  // NEWは「イベントが寮生に公開されてから24時間」に固定する。
  // 予約公開はpublish_at、即時公開（publish_at未設定）はcreated_atを公開開始として扱う。
  const now = Date.now();
  const publishedAt = new Date(event.publish_at ?? event.created_at).getTime();
  const isNew = !isMuted && publishedAt <= now && now - publishedAt < 24 * 60 * 60 * 1000;
  const closesAt = event.registration_closes_at ? new Date(event.registration_closes_at).getTime() : null;
  const isDeadlineSoon =
    !isMuted && closesAt != null && closesAt > now && closesAt - now < settings.eventDeadlineHours * 60 * 60 * 1000;
  const labels: EventCardLabel[] = [
    ...(isResidentEvent ? [{ text: "寮生企画", tone: "category" as const }] : []),
    ...(!isResidentEvent && settings.eventShowCategoryLabel ? [{ text: categoryLabel, tone: "category" as const }] : []),
    ...(settings.eventShowDeadlineLabel && isDeadlineSoon ? [{ text: dict.event.deadlineSoonTag, tone: "deadline" as const }] : []),
    ...(settings.eventShowNewLabel && isNew ? [{ text: dict.event.newTag, tone: "new" as const }] : []),
  ];
  const eventDate = formatEventDateTime(event.event_date, locale, isMuted, false);
  const eventTime = isMuted ? null : formatEventDateTime(event.event_date, locale, false, true).split(" ").at(-1);
  const titleLineClass = settings.eventTitleLines === 1 ? "line-clamp-1" : settings.eventTitleLines === 3 ? "line-clamp-3" : "line-clamp-2";
  const contentSpacingClass = settings.eventCardDensity === "comfortable" ? "gap-3 p-3 sm:p-4" : "gap-2 p-2.5 sm:p-3";

  return (
    <Link href={`/events/${event.id}`} prefetch={false} className="group block h-full w-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      <Card
        className={cn(
          // WebKitではfilter/transformを持つ子をoverflow-hiddenだけで丸めると
          // 角から描画が漏れるため、カード自身をstacking contextにして直接clipする。
          "relative z-0 flex h-full w-full flex-col min-w-0 overflow-hidden rounded-xl transition-all duration-200",
          isMuted
            ? "opacity-70 grayscale-[0.35] [@media(hover:hover)]:hover:opacity-100 [@media(hover:hover)]:hover:grayscale-0"
            : "[@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:border-foreground/15 [@media(hover:hover)]:group-hover:shadow-card-hover"
        )}
      >
        <div className="relative shrink-0 overflow-hidden">
          <EventPoster
            src={event.thumbnail_url ?? event.poster_url}
            alt={title}
            emptyLabel={dict.event.noImage}
            ratioClassName="aspect-square"
            roundedClassName="rounded-none"
            softenBackdrop={false}
            fit="cover"
          />
          <EventLabelRotator
            labels={labels}
            seed={event.id}
            enabled={settings.eventLabelRotationEnabled}
            intervalMs={labelRotationMs ?? settings.eventLabelDurationMs}
            jitterPercent={settings.eventLabelJitterPercent}
            shuffle={settings.eventLabelShuffleEnabled}
            limit={settings.eventLabelLimit}
            position={settings.eventLabelPosition}
          />
          {event.fee_amount && settings.eventShowFeeLabel ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-foreground px-2 py-1 text-[10px] font-semibold text-background shadow-sm">{dict.event.feePrefix}{event.fee_amount.toLocaleString()}{dict.event.feeUnit}</span>
          ) : !isResidentEvent && !event.fee_amount && event.show_free_tag !== false && settings.eventShowFreeLabel ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-success px-2 py-1 text-[10px] font-semibold text-success-foreground shadow-sm">{dict.event.freeLabel}</span>
          ) : null}
          {attendingFriends && attendingFriends.length > 0 && <FriendAvatarStack friends={attendingFriends} />}
        </div>
        {/* タイトルの行数をそろえ、本文の高さは内容に合わせ、日時を省略せず折り返す。 */}
        <CardContent className={cn("flex flex-1 flex-col", contentSpacingClass)}>
          <h3
            className={cn(
              "break-words text-sm font-semibold leading-snug transition-colors [@media(hover:hover)]:group-hover:text-primary sm:text-base",
              titleLineClass,
              isMuted && "text-sm"
            )}
          >
            {title}
          </h3>
          <div className="mt-auto flex items-end justify-between gap-1.5">
            <time dateTime={event.event_date} className="flex min-w-0 flex-wrap gap-x-1.5 text-xs leading-4 text-muted-foreground sm:text-sm sm:leading-5">
              <span>{eventDate}</span>
              {eventTime && <span className="whitespace-nowrap">{eventTime}</span>}
            </time>
            <ArrowRight aria-hidden="true" className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-all duration-200 sm:block [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:text-primary" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
