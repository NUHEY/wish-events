import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-6 w-16" /></div><div className="divide-y divide-border">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 px-3 py-3"><Skeleton className="h-11 w-11 shrink-0 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/3" /></div></div>)}</div></div>;
}
