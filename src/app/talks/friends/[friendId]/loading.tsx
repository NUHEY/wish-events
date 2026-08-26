import { Skeleton } from "@/components/ui/skeleton";

export default function FriendDmLoading() {
  return <div className="fixed inset-0 z-30 flex flex-col bg-background sm:static sm:mx-auto sm:max-w-2xl sm:gap-4"><div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl"><Skeleton className="h-8 w-8" /><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/4" /></div></div><div className="flex min-h-0 flex-1 flex-col justify-end gap-3 bg-[hsl(var(--chat-surface))] px-3.5 py-5"><Skeleton className="h-10 w-2/3 max-w-[75%] rounded-2xl" /><Skeleton className="ml-auto h-10 w-1/2 max-w-[75%] rounded-2xl" /><Skeleton className="h-10 w-3/5 max-w-[75%] rounded-2xl" /></div></div>;
}
