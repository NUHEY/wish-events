"use client";

import { useEffect, useMemo, useRef } from "react";

type PositionedMessage = { id: string; sender_id: string; created_at: string };

/** 入室時は最初の未読へ、未読がなければ末尾へ一度だけ移動する。 */
export function useInitialChatPosition(
  messages: PositionedMessage[],
  currentUserId: string,
  lastReadAt: string | null,
  scrollRef: React.RefObject<HTMLDivElement | null>,
  endRef: React.RefObject<HTMLDivElement | null>
) {
  const unreadMarkerRef = useRef<HTMLDivElement>(null);
  const positionedRef = useRef(false);
  const firstUnreadId = useMemo(() => {
    const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : Number.NEGATIVE_INFINITY;
    return (
      messages.find(
        (message) =>
          message.sender_id !== currentUserId && new Date(message.created_at).getTime() > lastReadTime
      )?.id ?? null
    );
  }, [currentUserId, lastReadAt, messages]);

  useEffect(() => {
    if (positionedRef.current) return;
    positionedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const container = scrollRef.current;
      const marker = unreadMarkerRef.current;
      if (container && marker && firstUnreadId) {
        const markerTop = marker.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
        container.scrollTop = Math.max(0, markerTop - 12);
      } else {
        endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [endRef, firstUnreadId, scrollRef]);

  return { firstUnreadId, unreadMarkerRef };
}
