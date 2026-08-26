import { Skeleton } from "@/components/ui/skeleton";

export default function AnnouncementDetailLoading() {
  return <div className="mx-auto flex max-w-2xl flex-col gap-5"><Skeleton className="h-5 w-16" /><Skeleton className="aspect-[16/9] w-full rounded-2xl" /><div className="space-y-2"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-3.5 w-32" /></div><div className="space-y-2.5"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></div>;
}
