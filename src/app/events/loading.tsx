import { Skeleton } from "@/components/ui/skeleton";

/**
 * イベント一覧の読み込み中プレースホルダー。
 * EventCard（画像は黄金比aspect-[1.618/1]、CardContentはh-[84px]/sm:h-[102px]の
 * 固定高さ）と実寸を合わせておくことで、読み込み完了時にレイアウトが
 * ガタつかないようにしている。EventCard側の寸法を変えた場合はここも揃えること。
 */
export default function EventsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full max-w-md rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="aspect-[1.618/1] animate-pulse bg-secondary/75 motion-reduce:animate-none" />
            <div className="flex h-[84px] flex-col justify-between gap-1.5 p-2.5 sm:h-[102px] sm:gap-2 sm:p-3.5">
              <Skeleton className="h-10 w-5/6 sm:h-11" />
              <Skeleton className="h-4 w-1/2 sm:h-5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
