import { EventPoster } from "@/components/events/event-poster";
import { EVENT_CARD_RATIO_CLASS, EVENT_POSTER_RATIO_CLASS } from "@/lib/event-media";

/** Uses the same image component and cropping as the published event. */
export function EventImagePreview({ thumbnailUrl, posterUrl }: { thumbnailUrl: string; posterUrl: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-3">
      <p className="mb-3 text-xs font-semibold">表示プレビュー</p>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <figure className="min-w-0 space-y-2">
          <EventPoster src={thumbnailUrl || posterUrl || null} alt="一覧で表示される画像" emptyLabel="既定のイベント画像" ratioClassName={EVENT_CARD_RATIO_CLASS} fit="cover" softenBackdrop={false} />
          <figcaption className="text-xs leading-relaxed"><span className="font-medium">一覧・ホーム・マイページ</span><span className="mt-0.5 block text-muted-foreground">16:10の横長。中央を基準に、枠からはみ出す部分を切り取ります。</span></figcaption>
        </figure>
        <figure className="min-w-0 space-y-2">
          <EventPoster src={posterUrl || thumbnailUrl || null} alt="詳細で表示される画像" emptyLabel="既定のイベント画像" ratioClassName={EVENT_POSTER_RATIO_CLASS} />
          <figcaption className="text-xs leading-relaxed"><span className="font-medium">イベント詳細</span><span className="mt-0.5 block text-muted-foreground">A4縦。画像全体を表示します。</span></figcaption>
        </figure>
      </div>
    </div>
  );
}
