import { EventsPageSkeleton } from "@/components/ui/page-skeletons";

/**
 * イベント一覧の読み込み中プレースホルダー。
 * EventCard（画像は黄金比aspect-[1.618/1]、CardContentはh-[84px]/sm:h-[102px]の
 * 固定高さ）と実寸を合わせておくことで、読み込み完了時にレイアウトが
 * ガタつかないようにしている。EventCard側の寸法を変えた場合はここも揃えること。
 */
export default function EventsLoading() {
  return <EventsPageSkeleton />;
}
