"use client";

import { useLocale } from "@/lib/i18n/locale-provider";
import type { useChatRecovery } from "./use-chat-recovery";

export function ChatConnectionStatus({ state }: { state: ReturnType<typeof useChatRecovery> }) {
  const locale = useLocale();
  if (state.online && !state.error && !state.catchingUp) return null;
  const en = locale === "en";
  const message = !state.online
    ? (en ? "Offline. Messages will sync when you reconnect." : "オフラインです。接続が戻るとメッセージを同期します。")
    : state.error
      ? (en ? "Connection interrupted. Retrying automatically…" : "接続を確認できません。自動で再試行しています…")
      : (en ? "Catching up on messages…" : "未取得のメッセージを同期しています…");
  return <div role="status" className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
    <span>{message}</span>
    {state.online && state.error && <button type="button" onClick={state.retry} disabled={state.isValidating} className="min-h-11 shrink-0 rounded-md px-3 font-semibold underline disabled:opacity-50">{en ? "Retry" : "再試行"}</button>}
  </div>;
}
