"use client";

import { useDict } from "@/lib/i18n/locale-provider";
import { EVENT_CARD_FRAME_CLASS, EVENT_CARD_RATIO_CLASS, EVENT_POSTER_RATIO_CLASS } from "@/lib/event-media";
import { cn } from "@/lib/utils";

type LoadingVariant = "home" | "events" | "event" | "tools" | "talks" | "chat" | "directory" | "profile" | "settings" | "dashboard" | "form" | "list";

function Block({ className = "" }: { className?: string }) {
  return <div className={cn("rounded-md bg-secondary", className)} />;
}

function Heading() {
  return <div className="space-y-2"><Block className="h-7 w-40 max-w-[70%]" /><Block className="h-4 w-64 max-w-[90%]" /></div>;
}

function EventCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-3 overflow-hidden sm:grid sm:grid-cols-3 lg:grid-cols-5" : "grid grid-cols-1 min-[400px]:grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"}>
      {Array.from({ length: compact ? 5 : 6 }, (_, key) => (
        <div key={key} className={cn("min-w-0 overflow-hidden rounded-xl border border-border", EVENT_CARD_FRAME_CLASS, compact && "w-40 shrink-0 sm:w-auto")}>
          <Block className={cn("rounded-none", EVENT_CARD_RATIO_CLASS)} />
          <div className="space-y-2 p-3"><Block className="h-4 w-full" /><Block className="h-4 w-2/3" /><Block className="mt-4 h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

function Rows({ avatar = false }: { avatar?: boolean }) {
  return <div className="divide-y divide-border rounded-xl border border-border">{Array.from({ length: 4 }, (_, key) => <div key={key} className="flex items-center gap-3 p-4">{avatar && <Block className="h-12 w-12 shrink-0 rounded-full" />}<div className="min-w-0 flex-1 space-y-2"><Block className="h-4 w-2/3" /><Block className="h-3 w-1/2" /></div><Block className="h-3 w-8 shrink-0" /></div>)}</div>;
}

function Content({ variant }: { variant: LoadingVariant }) {
  switch (variant) {
    case "home":
      return <><Heading /><Block className="h-5 w-36" /><EventCards compact /><Block className="h-5 w-28" /><Rows /></>;
    case "events":
      return <><Heading /><Block className="h-11 w-full" /><Block className="h-11 w-32" /><EventCards /></>;
    case "event":
      return <div className="mx-auto max-w-3xl space-y-4"><Block className="h-5 w-28" /><Block className={cn("mx-auto w-full max-w-[min(100%,49.5vh)]", EVENT_POSTER_RATIO_CLASS)} /><Heading /><Rows /></div>;
    case "tools":
      return <><Heading /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, key) => <div key={key} className="flex flex-col items-start gap-3 rounded-xl border border-border p-5"><Block className="h-10 w-10 rounded-xl" /><Block className="h-4 w-24 max-w-full" /></div>)}</div></>;
    case "talks":
      return <div className="mx-auto max-w-3xl space-y-4"><Heading /><div className="grid grid-cols-3 gap-2"><Block className="h-10" /><Block className="h-10" /><Block className="h-10" /></div><Rows avatar /></div>;
    case "chat":
      return <div className="mx-auto flex min-h-[65svh] max-w-3xl flex-col gap-5"><div className="flex items-center gap-3"><Block className="h-10 w-10 rounded-full" /><Block className="h-5 w-36" /></div><Block className="h-16 w-2/3 rounded-2xl" /><Block className="ml-auto h-12 w-1/2 rounded-2xl" /><Block className="h-20 w-3/5 rounded-2xl" /><Block className="mt-auto h-12 rounded-xl" /></div>;
    case "directory":
      return <><Heading /><Block className="h-11 w-full" /><div className="grid gap-3 sm:grid-cols-2"><Rows avatar /><Rows avatar /></div></>;
    case "profile":
      return <div className="mx-auto max-w-2xl space-y-4"><Block className="h-5 w-28" /><div className="overflow-hidden rounded-2xl border border-border"><Block className="h-32 rounded-none" /><div className="space-y-5 p-5"><Block className="-mt-12 h-20 w-20 rounded-full border-4 border-card" /><Heading /><div className="grid grid-cols-3 gap-3"><Block className="h-14" /><Block className="h-14" /><Block className="h-14" /></div><Block className="h-24" /><Rows /></div></div></div>;
    case "dashboard":
      return <><Heading /><div className="grid grid-cols-3 gap-3"><Block className="h-20" /><Block className="h-20" /><Block className="h-20" /></div><div className="grid gap-3 sm:grid-cols-2"><Rows /><Rows /></div></>;
    case "form":
      return <div className="mx-auto max-w-3xl space-y-5"><Heading />{[0, 1, 2].map(key => <div key={key} className="space-y-2"><Block className="h-4 w-28" /><Block className={key === 2 ? "h-32" : "h-11"} /></div>)}<Block className="h-11 w-32" /></div>;
    case "settings":
      return <div className="mx-auto max-w-2xl space-y-5"><Heading /><Rows /><Rows /></div>;
    default:
      return <><Heading /><Rows /><Rows /></>;
  }
}

/** Route-specific shapes appear while server data streams; the shared marker keeps navigation guarded. */
export function RouteLoading({ variant = "home" }: { variant?: LoadingVariant }) {
  const dict = useDict();
  return (
    <div data-route-loading role="status" aria-live="polite" aria-busy="true" className="min-h-[55vh] min-w-0">
      <p className="sr-only">{dict.common.pageLoading}</p>
      <div aria-hidden="true" className="space-y-5 motion-safe:animate-pulse"><Content variant={variant} /></div>
    </div>
  );
}
