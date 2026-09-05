"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT, NAVIGATION_END_EVENT } from "@/lib/navigation-signal";
import { useDict } from "@/lib/i18n/locale-provider";

export function NavigationFeedback({ lockEnabled = true, stallSeconds = 8 }: { lockEnabled?: boolean; stallSeconds?: number }) {
  const dict = useDict();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  // stateの再描画を待つと高速な連打が同じフレーム内をすり抜けるため、
  // 遷移の排他制御には同期的に更新できるrefを使う。
  const navigationLockedRef = useRef(false);
  const targetHrefRef = useRef<string | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const routeObserverRef = useRef<MutationObserver | null>(null);
  const currentSearch = searchParams.toString();

  useEffect(() => {
    // スマホではpathnameが先に切り替わり、重いServer Componentの描画が直後まで
    // 続くことがある。短い描画安定時間まで入力を保持し、連続RSC取得を防ぐ。
    const settleMs = window.matchMedia("(max-width: 639px)").matches ? 420 : 0;
    const settle = () => {
      if (document.querySelector("[data-route-loading]")) return;
      routeObserverRef.current?.disconnect();
      settleTimerRef.current = window.setTimeout(() => {
        if (document.querySelector("[data-route-loading]")) {
          routeObserverRef.current?.observe(document.body, { childList: true, subtree: true });
          return;
        }
        navigationLockedRef.current = false;
        targetHrefRef.current = null;
        setStalled(false);
        setTargetPath(null);
      }, settleMs);
    };
    routeObserverRef.current = new MutationObserver(settle);
    routeObserverRef.current.observe(document.body, { childList: true, subtree: true });
    settle();
    return () => {
      routeObserverRef.current?.disconnect();
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, [pathname, currentSearch]);
  useEffect(() => {
    if (!targetPath) return;
    // 遅い通信中にロックを外すと、さらに別の遷移を重ねてしまう。
    // 8秒後は排他状態を保ったまま、明示的な再読込だけを提示する。
    const timer = window.setTimeout(() => {
      setStalled(true);
    }, Math.min(30, Math.max(3, stallSeconds)) * 1000);
    return () => window.clearTimeout(timer);
  }, [targetPath, stallSeconds]);
  useEffect(() => {
    const start = (href: string) => {
      const next = new URL(href, window.location.origin);
      const sameRoute = `${next.pathname}${next.search}` === `${location.pathname}${location.search}`;
      if (sameRoute) {
        // ページ内アンカーだけは通常どおり動かし、同じURLへの無駄な再取得は止める。
        return next.hash && next.hash !== location.hash ? "in-page" : "same";
      }
      if (lockEnabled && navigationLockedRef.current) return "blocked";
      // 初期表示や直前の遷移の解除タイマーが、新しい遷移のロックを外さないようにする。
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      routeObserverRef.current?.disconnect();
      navigationLockedRef.current = true;
      targetHrefRef.current = next.href;
      setStalled(false);
      setTargetPath(next.pathname);
      return "started";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      // オーバーレイ描画前の連打と、キーボードによるボタン操作も同期的に止める。
      const target = event.target as Element | null;
      if (lockEnabled && navigationLockedRef.current && !target?.closest("[data-navigation-recovery]")) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
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
      if (event.defaultPrevented) return;
      if (lockEnabled && navigationLockedRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
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
    const onEnd = () => {
      routeObserverRef.current?.disconnect();
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      navigationLockedRef.current = false;
      targetHrefRef.current = null;
      setTargetPath(null);
      setStalled(false);
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onEnd(); };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener(NAVIGATION_START_EVENT, onSignal);
    window.addEventListener(NAVIGATION_END_EVENT, onEnd);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener(NAVIGATION_START_EVENT, onSignal);
      window.removeEventListener(NAVIGATION_END_EVENT, onEnd);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [lockEnabled]);

  if (!targetPath) return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15" role="progressbar" aria-label={dict.common.pageLoading}><div className="h-full w-1/2 animate-[navigation-progress_900ms_ease-in-out_infinite] rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))] motion-reduce:animate-pulse" /></div>
      {/* ヘッダー・下部タブを含む画面全体で次の入力を受け止め、進行中の遷移を1件に保つ。 */}
      {lockEnabled && <div className="fixed inset-0 z-[89] cursor-wait touch-none" aria-hidden />}
      {stalled && (
        <div className="fixed left-1/2 top-4 z-[101] flex w-[min(calc(100%_-_2rem),24rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-3 py-2.5 text-sm shadow-elevated backdrop-blur-md" role="alert">
          <span className="min-w-0 text-muted-foreground">{dict.common.loadingSlow}</span>
          <button
            type="button"
            data-navigation-recovery
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => window.location.assign(targetHrefRef.current ?? window.location.href)}
          >
            {dict.common.reload}
          </button>
        </div>
      )}
    </>
  );
}
