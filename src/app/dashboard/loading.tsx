import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return <div className="flex flex-col gap-6"><div className="grid grid-cols-3 gap-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div><Skeleton className="h-6 w-36" /><div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div></div>;
}
