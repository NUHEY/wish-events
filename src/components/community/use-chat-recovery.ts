"use client";

import { useEffect, useRef } from "react";

/**
 * RealtimeのWebSocketが一時的に切れてもメッセージを取りこぼさないための補完層。
 * 通常はSupabase Realtimeが即時反映し、この処理は一定間隔・オンライン復帰・
 * タブ再表示時に未取得分だけを確認する。別のメッセージDBを二重管理せず、
 * 永続データを唯一の正として復旧できるようにしている。
 */
export function useChatRecovery(recoveryKey: string, syncMissingMessages: () => Promise<void>) {
  const syncRef = useRef(syncMissingMessages);
  syncRef.current = syncMissingMessages;

  useEffect(() => {
    let active = true;
    let running = false;

    async function recover() {
      if (!active || running || document.visibilityState === "hidden" || !navigator.onLine) return;
      running = true;
      try {
        await syncRef.current();
      } catch (error) {
        // Realtime自体は動作し続けるため、補完問い合わせの一時失敗は次回に再試行する。
        console.warn("Chat recovery retry scheduled", error);
      } finally {
        running = false;
      }
    }

    const initialTimer = window.setTimeout(() => { void recover(); }, 1200);
    const interval = window.setInterval(() => { void recover(); }, 20_000);
    const handleVisible = () => { if (document.visibilityState === "visible") void recover(); };
    const handleOnline = () => { void recover(); };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("online", handleOnline);

    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("online", handleOnline);
    };
  }, [recoveryKey]);
}
