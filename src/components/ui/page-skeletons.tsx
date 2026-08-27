import { Skeleton } from "@/components/ui/skeleton";

const rows = (count: number) => Array.from({ length: count });

export function EventCardSkeleton() {
  return (
    <div className="h-full w-full overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[1.618/1] w-full rounded-none" />
      <div className="flex h-[84px] flex-col justify-between gap-1.5 p-2.5 sm:h-[102px] sm:gap-2 sm:p-3.5">
        <Skeleton className="h-10 w-5/6 sm:h-11" />
        <div className="flex items-center justify-between"><Skeleton className="h-4 w-1/2 sm:h-5" /><Skeleton className="h-4 w-4 rounded-full" /></div>
      </div>
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2 border-b border-border pb-6"><Skeleton className="h-9 w-56 max-w-full" /><Skeleton className="h-4 w-72 max-w-full" /></div>
      {rows(3).map((_, section) => (
        <section key={section} className="space-y-3">
          <div className="flex items-center gap-2"><Skeleton className="h-6 w-1.5 rounded-full" /><Skeleton className="h-6 w-36" /></div>
          <div className="-mx-4 flex gap-3 overflow-hidden px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4 xl:grid-cols-5">
            {rows(5).map((__, index) => <div key={index} className="w-40 shrink-0 sm:w-auto"><EventCardSkeleton /></div>)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function EventsPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <Skeleton className="h-8 w-44" /><Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-10 w-full rounded-full" />
        <div className="flex gap-2"><Skeleton className="h-9 w-28 rounded-full" /><Skeleton className="h-9 w-28 rounded-full" /></div>
        <Skeleton className="h-44 w-full rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {rows(10).map((_, index) => <EventCardSkeleton key={index} />)}
      </div>
    </div>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Skeleton className="h-8 w-8 rounded-full" />
      <Skeleton className="aspect-[3/4] max-h-[70vh] w-full rounded-lg" />
      <div className="flex gap-2"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-6 w-24 rounded-full" /></div>
      <div className="flex items-start justify-between gap-3"><Skeleton className="h-8 w-3/4" /><div className="flex gap-2"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-12" /></div></div>
      <div className="grid gap-3 sm:grid-cols-2">{rows(4).map((_, index) => <Skeleton key={index} className="h-5 w-full" />)}</div>
      <div className="space-y-2 rounded-lg border border-border p-4">{rows(4).map((_, index) => <Skeleton key={index} className={index === 3 ? "h-4 w-2/3" : "h-4 w-full"} />)}</div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4"><Skeleton className="h-4 w-36" /><Skeleton className="h-10 w-full rounded-xl" /></div>
      <div className="space-y-3 border-t border-border pt-4"><Skeleton className="h-6 w-28" /><Skeleton className="h-11 w-full rounded-xl" /></div>
    </div>
  );
}

export function AnnouncementDetailSkeleton() {
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
      <article className="flex min-w-0 flex-col gap-5">
        <Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <div className="space-y-3 pb-5"><Skeleton className="h-3 w-28" /><Skeleton className="h-8 w-4/5" /><div className="flex gap-2"><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-20 rounded-full" /></div><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-4 w-24" /></div></div>
        <div className="space-y-3">{rows(6).map((_, index) => <Skeleton key={index} className={index === 5 ? "h-4 w-2/3" : "h-4 w-full"} />)}</div>
        <div className="grid grid-cols-2 gap-2 border-t border-border pt-4"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
        <Skeleton className="h-28 w-full rounded-xl" />
      </article>
      <aside className="hidden space-y-2 lg:block"><Skeleton className="h-6 w-32" />{rows(6).map((_, index) => <Skeleton key={index} className="h-11 w-full rounded-none" />)}</aside>
    </div>
  );
}

export function DirectoryListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div><Skeleton className="h-8 w-44" /><Skeleton className="mt-2 h-4 w-72 max-w-full" /></div>
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="grid gap-2.5 sm:grid-cols-2">{rows(10).map((_, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"><Skeleton className="h-11 w-11 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-16" /></div></div>)}</div>
    </div>
  );
}

export function DirectoryProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-1.5"><Skeleton className="h-6 w-32" /><Skeleton className="h-3 w-24" /></div></div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <Skeleton className="aspect-[2.7/1] min-h-28 w-full rounded-none" />
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <div className="-mt-14 flex items-end justify-between"><Skeleton className="h-[84px] w-[84px] rounded-full ring-4 ring-card" /><Skeleton className="h-9 w-24" /></div>
          <div className="-mt-2 space-y-2"><Skeleton className="h-7 w-64 max-w-full" /><Skeleton className="h-4 w-20" /></div>
          <div className="grid grid-cols-3 gap-2"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex flex-wrap gap-2"><Skeleton className="h-10 w-40 rounded-xl" /><Skeleton className="h-10 w-28 rounded-xl" /></div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="flex gap-2 border-t border-border pt-4"><Skeleton className="h-9 w-28" /><Skeleton className="h-9 w-24" /></div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPageSkeleton() {
  return <div className="flex flex-col gap-6"><div className="grid grid-cols-3 gap-3">{rows(3).map((_, index) => <Skeleton key={index} className="h-20 rounded-lg" />)}</div><Skeleton className="h-7 w-40" /><div className="space-y-3">{rows(5).map((_, index) => <div key={index} className="flex min-h-24 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"><div className="space-y-2"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-32" /></div><div className="flex gap-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-9 w-16" /><Skeleton className="h-9 w-20" /></div></div>)}</div></div>;
}

export function ParticipantsPageSkeleton() {
  return <div className="flex flex-col gap-4"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-7 w-2/3" /><div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-24" /><div className="flex gap-2"><Skeleton className="h-9 w-64 rounded-full" /><Skeleton className="h-9 w-24" /></div></div><div className="overflow-hidden rounded-lg border border-border"><Skeleton className="h-11 w-full rounded-none" />{rows(8).map((_, index) => <div key={index} className="grid grid-cols-5 gap-4 border-t border-border p-3"><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4" /><Skeleton className="h-4" /></div>)}</div></div>;
}

export function ProfileFormPageSkeleton({ showBack = false }: { showBack?: boolean }) {
  return <div className="mx-auto flex max-w-md flex-col gap-3">{showBack && <Skeleton className="h-8 w-8 rounded-full" />}<div className="rounded-lg border border-border bg-card p-5"><div className="mb-5 space-y-2"><Skeleton className="h-6 w-36" /><Skeleton className="h-4 w-64 max-w-full" /></div><div className="space-y-4"><Skeleton className="aspect-[3/1] w-full rounded-xl" /><Skeleton className="mx-auto h-20 w-20 rounded-full" />{rows(8).map((_, index) => <div key={index} className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className={index === 7 ? "h-24 w-full rounded-xl" : "h-11 w-full rounded-xl"} /></div>)}<Skeleton className="h-11 w-full rounded-xl" /></div></div></div>;
}

export function OnboardingPageSkeleton() {
  return <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-4xl flex-col justify-center py-1 sm:py-5"><div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"><div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-4 w-24" /></div><Skeleton className="h-4 w-12" /></div><Skeleton className="h-1 w-1/4 rounded-none" /><div className="grid min-h-[35rem] md:grid-cols-[0.92fr_1.08fr]"><div className="flex items-center bg-secondary/20 p-4 sm:p-7 md:border-r md:border-border"><Skeleton className="mx-auto h-52 w-full max-w-sm rounded-2xl" /></div><div className="flex flex-col p-5 sm:p-8"><div className="flex justify-between"><Skeleton className="h-11 w-11 rounded-xl" /><Skeleton className="h-4 w-20" /></div><Skeleton className="mt-6 h-3 w-28" /><Skeleton className="mt-3 h-16 w-full" /><Skeleton className="mt-3 h-14 w-full" /><div className="mt-7 space-y-3">{rows(3).map((_, index) => <div key={index} className="flex items-center gap-3"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 flex-1" /></div>)}</div><Skeleton className="mt-auto h-11 w-full rounded-md" /></div></div><div className="flex justify-center gap-1.5 border-t border-border py-3">{rows(5).map((_, index) => <Skeleton key={index} className={index === 0 ? "h-2 w-7 rounded-full" : "h-2 w-2 rounded-full"} />)}</div></div></div>;
}

export function NotificationsPageSkeleton() {
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><div className="flex items-center gap-2"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-6 w-16" /></div><div className="divide-y divide-border">{rows(7).map((_, index) => <div key={index} className="flex items-center gap-3 px-3 py-3"><Skeleton className="h-11 w-11 shrink-0 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-3 w-16" /></div><Skeleton className="h-2 w-2 rounded-full" /></div>)}</div></div>;
}

export function TalksListSkeleton() {
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between"><div><Skeleton className="h-8 w-32" /><Skeleton className="mt-2 h-4 w-64 max-w-full" /></div><Skeleton className="h-9 w-full rounded-full sm:w-[252px]" /></div><div className="divide-y divide-border/70">{rows(7).map((_, index) => <div key={index} className="flex items-center gap-3 py-3"><Skeleton className="h-[58px] w-[58px] shrink-0 rounded-full" /><div className="flex-1"><Skeleton className="h-4 w-2/3" /><Skeleton className="mt-2 h-4 w-5/6" /></div><Skeleton className="h-3 w-8" /></div>)}</div></div>;
}

export function TalkRoomSkeleton() {
  return <div className="fixed inset-0 z-30 flex flex-col bg-background sm:static sm:mx-auto sm:max-w-2xl"><div className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:rounded-t-2xl"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/4" /></div></div><div className="flex min-h-0 flex-1 flex-col justify-end gap-2 bg-[radial-gradient(ellipse_at_top,hsl(var(--chat-gradient-start))_0%,hsl(var(--chat-surface))_100%)] px-3.5 py-5"><Skeleton className="h-14 w-2/3 max-w-[75%] rounded-2xl" /><Skeleton className="ml-auto h-10 w-1/2 max-w-[75%] rounded-2xl" /><Skeleton className="h-20 w-3/5 max-w-[75%] rounded-2xl" /><Skeleton className="ml-auto h-12 w-2/3 max-w-[75%] rounded-2xl" /></div><div className="border-t border-border bg-card p-3"><Skeleton className="h-12 w-full rounded-xl" /></div></div>;
}
