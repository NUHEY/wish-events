"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT } from "@/lib/navigation-signal";
import {
  AnnouncementDetailSkeleton,
  DashboardPageSkeleton,
  DirectoryListSkeleton,
  DirectoryProfileSkeleton,
  EventDetailSkeleton,
  EventsPageSkeleton,
  HomePageSkeleton,
  NotificationsPageSkeleton,
  OnboardingPageSkeleton,
  ParticipantsPageSkeleton,
  ProfileFormPageSkeleton,
  TalkRoomSkeleton,
  TalksListSkeleton,
} from "@/components/ui/page-skeletons";

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

function RouteShape({ pathname }: { pathname: string }) {
  if (pathname.startsWith("/talks/")) return <TalkRoomSkeleton />;
  if (pathname === "/talks") return <TalksListSkeleton />;
  if (pathname === "/events") return <EventsPageSkeleton />;
  if (/^\/events\/[^/]+$/.test(pathname)) return <EventDetailSkeleton />;
  if (pathname.startsWith("/events/")) return <ProfileFormPageSkeleton showBack />;
  if (/^\/dashboard\/[^/]+\/participants$/.test(pathname)) return <ParticipantsPageSkeleton />;
  if (pathname.startsWith("/dashboard")) return <DashboardPageSkeleton />;
  if (pathname === "/directory") return <DirectoryListSkeleton />;
  if (pathname.startsWith("/directory/")) return <DirectoryProfileSkeleton />;
  if (pathname.startsWith("/announcements/")) return <AnnouncementDetailSkeleton />;
  if (pathname === "/notifications") return <NotificationsPageSkeleton />;
  if (pathname.startsWith("/profile/")) return <ProfileFormPageSkeleton showBack={pathname === "/profile/edit"} />;
  if (pathname === "/onboarding") return <OnboardingPageSkeleton />;
  return <HomePageSkeleton />;
}
