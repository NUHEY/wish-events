import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileSetupLoading() {
  return <div className="mx-auto max-w-md"><div className="rounded-xl border border-border p-5"><div className="mb-5 space-y-2"><Skeleton className="h-5 w-28" /><Skeleton className="h-3.5 w-56" /></div><div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-20" /><Skeleton className="h-11 w-full rounded-xl" /></div>)}</div></div></div>;
}
