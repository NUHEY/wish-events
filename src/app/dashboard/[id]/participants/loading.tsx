import { Skeleton } from "@/components/ui/skeleton";

export default function ParticipantsLoading() {
  return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-20" /><Skeleton className="h-7 w-1/2" /><Skeleton className="h-9 w-full max-w-sm rounded-full" /><div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div></div>;
}
