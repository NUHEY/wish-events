"use client";

import { useEffect, useRef, useState } from "react";
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
  const [stalled, setStalled] = useState(false);
  // stateの再描画を待つと高速な連打が同じフレーム内をすり抜けるため、
  // 遷移の排他制御には同期的に更新できるrefを使う。
  const navigationLockedRef = useRef(false);
  const targetHrefRef = useRef<string | null>(null);
  const currentSearch = searchParams.toString();

  useEffect(() => {
    navigationLockedRef.current = false;
    targetHrefRef.current = null;
    setStalled(false);
    setTargetPath(null);
  }, [pathname, currentSearch]);
  useEffect(() => {
    if (!targetPath) return;
    // 遅い通信中にロックを外すと、さらに別の遷移を重ねてしまう。
    // 8秒後は排他状態を保ったまま、明示的な再読込だけを提示する。
    const timer = window.setTimeout(() => {
      setStalled(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [targetPath]);
  useEffect(() => {
    const start = (href: string) => {
      const next = new URL(href, window.location.origin);
      const sameRoute = `${next.pathname}${next.search}` === `${location.pathname}${location.search}`;
      if (sameRoute) {
        // ページ内アンカーだけは通常どおり動かし、同じURLへの無駄な再取得は止める。
        return next.hash && next.hash !== location.hash ? "in-page" : "same";
      }
      if (navigationLockedRef.current) return "blocked";
      navigationLockedRef.current = true;
      targetHrefRef.current = next.href;
      setStalled(false);
      setTargetPath(next.pathname);
      return "started";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.download || link.origin !== window.location.origin) return;
      const result = start(link.href);
      if (result === "blocked" || result === "same") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() !== "get") return;
      const next = new URL(form.action || window.location.href, window.location.origin);
      const values = new FormData(form);
      next.search = "";
      values.forEach((value, key) => { if (typeof value === "string" && value) next.searchParams.append(key, value); });
      const result = start(next.href);
      if (result === "blocked" || result === "same") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onSignal = (event: Event) => {
      const result = start((event as CustomEvent<{ href: string }>).detail.href);
      if (result !== "started") event.preventDefault();
    };
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
      {/* ヘッダー・下部タブを含む画面全体で次の入力を受け止め、進行中の遷移を1件に保つ。 */}
      <div className="fixed inset-0 z-[89] cursor-wait" aria-hidden />
      {stalled && (
        <div className="fixed left-1/2 top-4 z-[101] flex w-[min(calc(100%_-_2rem),24rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-3 py-2.5 text-sm shadow-elevated backdrop-blur-md" role="alert">
          <span className="min-w-0 text-muted-foreground">読み込みに時間がかかっています</span>
          <button
            type="button"
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => window.location.assign(targetHrefRef.current ?? window.location.href)}
          >
            読み込み直す
          </button>
        </div>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mobile-tab-bar-height)+env(safe-area-inset-bottom,0px))] top-[65px] z-[90] overflow-hidden bg-background sm:bottom-0" aria-live="polite" aria-label="移動先を読み込み中">
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
