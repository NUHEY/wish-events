"use client";
import { Heart } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleEventLike } from "@/actions/event-community";
export function EventLikeButton({ eventId, count, liked }: { eventId: string; count: number; liked: boolean }) {
  const [pending, startTransition] = useTransition(); const router = useRouter();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => toggleEventLike(eventId, liked).then(() => router.refresh()))} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${liked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}><Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{count || "いいね"}</button>;
}
