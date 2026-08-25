"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { toggleEventLike } from "@/actions/event-community";

export function EventLikeButton({ eventId, count, liked }: { eventId: string; count: number; liked: boolean }) {
  // 体感速度優先で即座にUIへ反映し、サーバーには裏で反映する。失敗時のみ元に戻す。
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticCount, setOptimisticCount] = useState(count);

  function toggle() {
    const prevLiked = optimisticLiked;
    const prevCount = optimisticCount;
    const nextLiked = !prevLiked;
    setOptimisticLiked(nextLiked);
    setOptimisticCount(Math.max(0, prevCount + (nextLiked ? 1 : -1)));
    toggleEventLike(eventId, prevLiked).catch(() => {
      setOptimisticLiked(prevLiked);
      setOptimisticCount(prevCount);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        optimisticLiked
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary"
      }`}
    >
      <Heart className={`h-4 w-4 ${optimisticLiked ? "fill-current" : ""}`} />
      {optimisticCount || "いいね"}
    </button>
  );
}
