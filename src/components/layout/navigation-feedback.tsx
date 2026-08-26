"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT } from "@/lib/navigation-signal";

export function NavigationFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [targetPath, setTargetPath] = useState<string | null>(null);

  useEffect(() => setTargetPath(null), [pathname, searchParams]);
  useEffect(() => {
    if (!targetPath) return;
    const timer = window.setTimeout(() => setTargetPath(null), 8000);
    return () => window.clearTimeout(timer);
  }, [targetPath]);
  useEffect(() => {
    const start = (href: string) => {
      const next = new URL(href, window.location.origin);
      if (`${next.pathname}${next.search}` !== `${location.pathname}${location.search}`) setTargetPath(next.pathname);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.download || link.origin !== window.location.origin) return;
      start(link.href);
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() !== "get") return;
      const next = new URL(form.action || window.location.href, window.location.origin);
      const values = new FormData(form);
      next.search = "";
      values.forEach((value, key) => { if (typeof value === "string" && value) next.searchParams.append(key, value); });
      start(next.href);
    };
    const onSignal = (event: Event) => start((event as CustomEvent<{ href: string }>).detail.href);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(NAVIGATION_START_EVENT, onSignal);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(NAVIGATION_START_EVENT, onSignal);
    };
  }, []);

  if (!targetPath) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15" role="progressbar" aria-label="ページを読み込み中"><div className="h-full w-1/2 animate-[navigation-progress_900ms_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))] motion-reduce:animate-pulse" /></div>
      <div className="pointer-events-none fixed inset-x-0 bottom-[65px] top-[65px] z-[90] overflow-hidden bg-background sm:bottom-0" aria-live="polite" aria-label="移動先を読み込み中">
        <div className="mx-auto h-full max-w-5xl overflow-hidden px-4 py-4 sm:py-6"><RouteShape pathname={targetPath} /></div>
      </div>
    </>
  );
}

function Bone({ className }: { className: string }) { return <div className={`rounded-xl bg-secondary/75 ${className}`} />; }

function RouteShape({ pathname }: { pathname: string }) {
  const base = "flex h-full animate-pulse flex-col gap-4 motion-reduce:animate-none";
  if (pathname.startsWith("/talks/")) return <div className={base}><div className="flex items-center gap-3 border-b border-border pb-3"><Bone className="h-10 w-10 rounded-full" /><div className="flex-1"><Bone className="h-4 w-36" /><Bone className="mt-2 h-3 w-20" /></div></div><div className="flex flex-1 flex-col justify-end gap-2 pb-3"><Bone className="h-14 w-2/3 self-start rounded-xl" /><Bone className="h-10 w-1/2 self-end rounded-xl" /><Bone className="h-20 w-3/4 self-start rounded-xl" /></div><Bone className="h-12 w-full rounded-xl" /></div>;
  if (pathname === "/talks") return <div className={`${base} mx-auto max-w-2xl`}><div className="flex items-end justify-between border-b border-border pb-3"><div><Bone className="h-7 w-32" /><Bone className="mt-2 h-3 w-56" /></div><Bone className="h-9 w-56 rounded-full" /></div>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 py-2"><Bone className="h-[58px] w-[58px] shrink-0 rounded-full" /><div className="flex-1"><Bone className="h-4 w-2/3" /><Bone className="mt-2 h-3 w-5/6" /></div></div>)}</div>;
  if (pathname.startsWith("/events")) return <div className={base}><Bone className="h-8 w-44" /><Bone className="h-10 w-full max-w-lg rounded-full" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="overflow-hidden rounded-2xl border border-border"><Bone className="aspect-[4/3] w-full rounded-none" /><div className="p-3"><Bone className="h-4 w-5/6" /><Bone className="mt-2 h-3 w-1/2" /></div></div>)}</div></div>;
  if (pathname.startsWith("/dashboard")) return <div className={base}><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Bone key={i} className="h-20 sm:h-24" />)}</div><div className="grid grid-cols-3 gap-3"><Bone className="h-20 sm:h-24" /><Bone className="h-20 sm:h-24" /><Bone className="h-20 sm:h-24" /></div>{Array.from({ length: 3 }).map((_, i) => <Bone key={i} className="h-20 w-full" />)}</div>;
  if (pathname.startsWith("/directory")) return <div className={base}><Bone className="h-8 w-44" /><Bone className="h-11 w-full" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Bone key={i} className="h-28" />)}</div></div>;
  return <div className={base}><Bone className="h-8 w-48" /><Bone className="h-4 w-72" /><Bone className="h-52 w-full" /><Bone className="h-24 w-full" /></div>;
}
