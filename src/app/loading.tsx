import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return <div className="flex flex-col gap-8"><div className="space-y-2 border-b border-border pb-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64" /></div>{[0, 1, 2].map((section) => <section key={section} className="space-y-3"><Skeleton className="h-5 w-32" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="overflow-hidden rounded-lg border border-border bg-card"><Skeleton className="aspect-[1.618/1] rounded-none" /><div className="flex h-[84px] flex-col justify-between p-2.5 sm:h-[102px] sm:p-3.5"><Skeleton className="h-10 w-5/6" /><Skeleton className="h-4 w-1/2" /></div></div>)}</div></section>)}</div>;
}
