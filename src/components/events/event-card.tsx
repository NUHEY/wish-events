import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EventPoster } from "@/components/events/event-poster";
import { EventLabelRotator, type EventCardLabel } from "@/components/events/event-label-rotator";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
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
  const labels: EventCardLabel[] = [
    { text: categoryLabel, tone: "category" },
    ...(isDeadlineSoon ? [{ text: dict.event.deadlineSoonTag, tone: "deadline" as const }] : []),
    ...(isNew ? [{ text: dict.event.newTag, tone: "new" as const }] : []),
  ];

  return (
    <Link href={`/events/${event.id}`} prefetch={false} className="group block h-full w-full min-w-0">
      <Card
        className={cn(
          // WebKitではfilter/transformを持つ子をoverflow-hiddenだけで丸めると
          // 角から描画が漏れるため、カード自身をstacking contextにして直接clipする。
          "relative z-0 h-full w-full min-w-0 overflow-hidden rounded-xl transition-all duration-200",
          isMuted
            ? "opacity-70 grayscale-[0.35] [@media(hover:hover)]:hover:opacity-100 [@media(hover:hover)]:hover:grayscale-0"
            : "[@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:border-foreground/15 [@media(hover:hover)]:group-hover:shadow-card-hover"
        )}
      >
        <div className="relative overflow-hidden">
          <EventPoster
            src={event.poster_url}
            alt={title}
            emptyLabel={dict.event.noImage}
            ratioClassName="aspect-[1.618/1]"
            roundedClassName="rounded-none"
            softenBackdrop={false}
          />
          <EventLabelRotator labels={labels} />
          {event.fee_amount ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-foreground/85 px-2 py-1 text-[10px] font-semibold text-background shadow-sm">{dict.event.feePrefix}{event.fee_amount.toLocaleString()}{dict.event.feeUnit}</span>
          ) : event.show_free_tag !== false ? (
            <span className="absolute bottom-2 right-2 rounded-full bg-success/90 px-2 py-1 text-[10px] font-semibold text-success-foreground shadow-sm">{dict.event.freeLabel}</span>
          ) : null}
          {attendingFriends && attendingFriends.length > 0 && <FriendAvatarStack friends={attendingFriends} />}
        </div>
        {/*
         * カードの高さを常に完全に同一にするため、min-h ではなく h（固定値）を使う。
         * タイトルのh3も行数に関わらず常に同じ高さ（2行分）を確保し、1行で収まる
         * タイトルでも余白として同じ高さを保つ。長いタイトルは line-clamp によって
         * 2行目末尾に「…」で省略される。
         */}
        <CardContent className={cn("flex h-[84px] flex-col justify-between gap-1.5 p-2.5 sm:h-[102px] sm:gap-2 sm:p-3.5", isMuted && "p-2.5 sm:p-3")}>
          <h3
            className={cn(
              "line-clamp-2 h-10 text-sm font-semibold leading-snug transition-colors [@media(hover:hover)]:group-hover:text-primary sm:h-11 sm:text-base",
              isMuted && "text-sm"
            )}
          >
            {title}
          </h3>
          <div className="flex h-4 items-center justify-between gap-2 sm:h-5">
            {/*
             * 直近のイベントは日時が気になる情報なので年を省き時刻まで収める。
             * 過去のイベント（isMuted）は時刻の重要度が低いため省き、代わりに
             * 年度の文脈を残す。
             */}
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {formatEventDateTime(event.event_date, locale, isMuted, !isMuted)}
            </p>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-all duration-200 [@media(hover:hover)]:group-hover:translate-x-0.5 [@media(hover:hover)]:group-hover:text-primary" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
