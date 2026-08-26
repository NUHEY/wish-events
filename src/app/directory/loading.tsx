import { Skeleton } from "@/components/ui/skeleton";

export default function DirectoryLoading() {
  return <div className="flex flex-col gap-4"><div className="space-y-2"><Skeleton className="h-7 w-40" /><Skeleton className="h-4 w-64" /></div><Skeleton className="h-10 w-full" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div></div>;
}
