"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * スマホのトーク画面を、アドレスバーやソフトウェアキーボードを除いた
 * 「実際に見えている領域」に合わせる。100vhだけではiOS Safariの
 * VisualViewport変化を取りこぼし、入力欄が画面外へ隠れるため専用枠にする。
 */
export function MobileChatViewport({ children, className }: { children: React.ReactNode; className?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const visualViewport = window.visualViewport;
    const updateViewport = () => {
      const height = visualViewport?.height ?? window.innerHeight;
      const top = visualViewport?.offsetTop ?? 0;
      element.style.setProperty("--chat-visual-height", `${Math.round(height)}px`);
      element.style.setProperty("--chat-visual-top", `${Math.round(top)}px`);
    };

    const mobileQuery = window.matchMedia("(max-width: 639px)");
    const previousOverflow = document.body.style.overflow;
    if (mobileQuery.matches) document.body.style.overflow = "hidden";

    updateViewport();
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      style={
        {
          "--chat-visual-height": "100dvh",
          "--chat-visual-top": "0px",
        } as CSSProperties
      }
      className={cn(
        "fixed inset-x-0 top-[var(--chat-visual-top)] z-30 flex h-[var(--chat-visual-height)] min-h-0 flex-col overflow-hidden overscroll-none bg-background pt-[env(safe-area-inset-top)] sm:static sm:mx-auto sm:h-[calc(100dvh-8rem)] sm:max-w-2xl sm:pt-0",
        className
      )}
    >
      {children}
    </div>
  );
}
