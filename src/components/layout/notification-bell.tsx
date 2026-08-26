"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

/** ヘッダー右上の通知ボタン。未読があれば赤いドットを表示する（トークの未読表示と同じ見た目）。 */
export function NotificationBell({ hasUnread }: { hasUnread: boolean }) {
  return (
    <Link
      href="/notifications"
      aria-label="通知"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Bell className="h-5 w-5" />
      {hasUnread && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />}
    </Link>
  );
}
