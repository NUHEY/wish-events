"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FeatureFlagState } from "@/lib/feature-flags";
import { signalNavigation } from "@/lib/navigation-signal";

const TABS = ["events", "friends"] as const;
export type TalksTab = (typeof TABS)[number];

const LABELS: Record<TalksTab, string> = { events: "イベント", friends: "友達" };

/**
 * トーク画面を「イベント」（参加イベントのお知らせ・会話）と「友達」
 * （友達同士の1:1メッセージ）の2タブに分けるためのセグメントボタン。
 */
export function TalksTabBar({ hasUnreadFriends = false, friendDmState = "hidden" }: { hasUnreadFriends?: boolean; friendDmState?: FeatureFlagState }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeActive = (searchParams.get("tab") as TalksTab | null) ?? "events";
  const [active, setActive] = useState<TalksTab>(routeActive);
  const [pending, startTransition] = useTransition();
  const visibleTabs = friendDmState === "hidden" ? TABS.filter((tab) => tab !== "friends") : TABS;

  useEffect(() => setActive(routeActive), [routeActive]);

  function setTab(tab: TalksTab) {
    if (pending || tab === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "events") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    const href = qs ? `${pathname}?${qs}` : pathname;
    if (!signalNavigation(href)) return;
    setActive(tab);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="talks tab"
      className={cn(
        "grid w-full shrink-0 grid-cols-2 items-center gap-0.5 rounded-full border border-border bg-secondary/50 p-0.5 transition-opacity sm:w-[252px]",
        visibleTabs.length === 1 && "grid-cols-1 sm:w-[126px]",
        pending && "opacity-60"
      )}
    >
      {visibleTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          disabled={pending}
          onClick={() => setTab(tab)}
          className={cn(
            "relative min-w-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-wait",
            active === tab
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <span className="inline-flex items-center gap-1">{LABELS[tab]}{tab === "friends" && friendDmState === "beta" && <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wide", active === tab ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary")}>BETA</span>}</span>
          {tab === "friends" && hasUnreadFriends && active !== tab && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
      ))}
    </div>
  );
}
