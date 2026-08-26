import { Skeleton } from "@/components/ui/skeleton";

export default function EventDetailLoading() {
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><Skeleton className="h-8 w-20" /><Skeleton className="aspect-[16/9] w-full rounded-2xl" /><div className="space-y-2"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-4 w-1/2" /></div><div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div><Skeleton className="h-11 w-full rounded-xl" /><Skeleton className="h-24 w-full rounded-2xl" /></div>;
}
