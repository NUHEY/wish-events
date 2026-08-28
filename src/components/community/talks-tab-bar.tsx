"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FeatureFlagState } from "@/lib/feature-flags";
import { signalNavigation } from "@/lib/navigation-signal";

const TABS = ["events", "floor", "friends"] as const;
export type TalksTab = (typeof TABS)[number];

const LABELS: Record<TalksTab, string> = { events: "イベント", floor: "フロア", friends: "友達" };

/**
 * 「イベント」「同じ階のグループ」「友達」の3種類を、隣のラベル幅に
 * 影響されない等幅タブで切り替える。
 */
export function TalksTabBar({
  hasUnreadFloor = false,
  hasUnreadFriends = false,
  floorGroupState = "hidden",
  friendDmState = "hidden",
}: {
  hasUnreadFloor?: boolean;
  hasUnreadFriends?: boolean;
  floorGroupState?: FeatureFlagState;
  friendDmState?: FeatureFlagState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = (searchParams.get("tab") as TalksTab | null) ?? "events";
  const [pending, startTransition] = useTransition();
  const visibleTabs = TABS.filter((tab) =>
    (tab !== "floor" || floorGroupState !== "hidden")
    && (tab !== "friends" || friendDmState !== "hidden")
  );

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
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <div
      role="tablist"
      aria-label="talks tab"
      className={cn(
        "grid w-full shrink-0 grid-cols-3 items-center gap-0.5 rounded-full border border-border bg-secondary/50 p-0.5 transition-opacity sm:w-[348px]",
        visibleTabs.length === 2 && "grid-cols-2 sm:w-[252px]",
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
          <span className="inline-flex items-center gap-1">{LABELS[tab]}{((tab === "floor" && floorGroupState === "beta") || (tab === "friends" && friendDmState === "beta")) && <span className={cn("rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wide", active === tab ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary")}>BETA</span>}</span>
          {tab === "floor" && hasUnreadFloor && active !== tab && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
          {tab === "friends" && hasUnreadFriends && active !== tab && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
          )}
        </button>
      ))}
    </div>
  );
}
