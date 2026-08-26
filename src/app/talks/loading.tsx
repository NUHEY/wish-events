import { Skeleton } from "@/components/ui/skeleton";

export default function TalksLoading() {
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between"><div><Skeleton className="h-7 w-32" /><Skeleton className="mt-2 h-3 w-56" /></div><Skeleton className="h-9 w-full rounded-full sm:w-[252px]" /></div><div className="divide-y divide-border/70">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 py-3"><Skeleton className="h-[58px] w-[58px] shrink-0 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-3 w-5/6" /></div><Skeleton className="h-3 w-8" /></div>)}</div></div>;
}
