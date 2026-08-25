"use client";

import { useEffect } from "react";
import { markAllNotificationsRead } from "@/actions/notifications";

/**
 * 通知一覧を開いた時点で、未読の通知をまとめて既読にする（Instagram等と同じ挙動）。
 * 表示だけの副作用のため、レンダリング中ではなくマウント後に1度だけ呼び出す。
 */
export function MarkAllReadOnView({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    markAllNotificationsRead();
  }, [hasUnread]);

  return null;
}
