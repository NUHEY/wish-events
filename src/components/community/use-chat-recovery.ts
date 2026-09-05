"use client";

import { useRef, useSyncExternalStore } from "react";
import useSWR from "swr";

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Realtime delivers immediately; SWR reconciles durable messages after gaps.
 * Only the recovery result is cached, never message contents. Keys include the
 * signed-in user. Sending is deliberately excluded from automatic retries.
 */
export function useChatRecovery(recoveryKey: string, syncMissingMessages: () => Promise<boolean | void>) {
  const syncRef = useRef(syncMissingMessages);
  syncRef.current = syncMissingMessages;
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const { data, error, isValidating, mutate } = useSWR(
    ["chat-recovery", recoveryKey],
    async () => ({ hasMore: (await syncRef.current()) === true }),
    {
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      // Drain a backlog promptly, then reduce idle traffic.
      refreshInterval: (result) => result?.hasMore ? 300 : 20_000,
      dedupingInterval: 250,
      focusThrottleInterval: 5_000,
      errorRetryInterval: 5_000,
      shouldRetryOnError: true,
      isPaused: () => typeof navigator !== "undefined" && !navigator.onLine,
    }
  );
  return { online, error: !!error, catchingUp: !!data?.hasMore, isValidating,
    retry: () => { void mutate().catch(() => {}); } };
}
