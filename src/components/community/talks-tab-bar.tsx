"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = ["events", "friends"] as const;
export type TalksTab = (typeof TABS)[number];

const LABELS: Record<TalksTab, string> = { events: "イベント", friends: "友達" };

/**
 * トーク画面を「イベント」（参加イベントのお知らせ・会話）と「友達」
 * （友達同士の1:1メッセージ）の2タブに分けるためのセグメントボタン。
 */
export function TalksTabBar({ hasUnreadFriends = false }: { hasUnreadFriends?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = (searchParams.get("tab") as TalksTab | null) ?? "events";
  const [pending, startTransition] = useTransition();

  function setTab(tab: TalksTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "events") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <div
      role="tablist"
      aria-label="talks tab"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-secondary/50 p-0.5 transition-opacity",
        pending && "opacity-60"
      )}
    >
      {TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => setTab(tab)}
          className={cn(
            "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            active === tab
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {LABELS[tab]}
          {tab === "friends" && hasUnreadFriends && active !== tab && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
      ))}
    </div>
  );
}
