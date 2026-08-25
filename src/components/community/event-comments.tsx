"use client";

import { Heart, Send } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEventComment, toggleEventCommentLike } from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Comment = { id: string; user_id: string; body: string; created_at: string; user: { full_name: string | null; avatar_url: string | null } | null; likeCount: number; likedByMe: boolean };
export function EventComments({ eventId, comments }: { eventId: string; comments: Comment[] }) {
  const [body, setBody] = useState(""); const [pending, startTransition] = useTransition(); const router = useRouter();
  function submit() { startTransition(async () => { const result = await addEventComment(eventId, body); if (!result?.error) { setBody(""); router.refresh(); } }); }
  return <section className="flex flex-col gap-3 border-t border-border pt-5"><h2 className="font-bold">コメント</h2><div className="flex gap-2"><Input value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="イベントについてコメントする" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /><Button size="icon" disabled={pending || !body.trim()} onClick={submit} aria-label="コメントを送信"><Send className="h-4 w-4" /></Button></div><div className="flex flex-col gap-3">{comments.map((comment) => <div key={comment.id} className="flex gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs">{comment.user?.avatar_url ? <img src={comment.user.avatar_url} alt="" className="h-full w-full object-cover" /> : comment.user?.full_name?.charAt(0) ?? "?"}</span><div className="min-w-0 flex-1 rounded-xl bg-secondary/45 px-3 py-2"><div className="flex items-baseline justify-between gap-2"><p className="text-xs font-semibold">{comment.user?.full_name ?? "名前未登録"}</p><p className="text-[10px] text-muted-foreground">{new Date(comment.created_at).toLocaleDateString("ja-JP")}</p></div><p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p><button type="button" onClick={() => startTransition(() => toggleEventCommentLike(comment.id, eventId, comment.likedByMe).then(() => router.refresh()))} className={`mt-1.5 inline-flex items-center gap-1 text-xs ${comment.likedByMe ? "text-primary" : "text-muted-foreground"}`}><Heart className={`h-3.5 w-3.5 ${comment.likedByMe ? "fill-current" : ""}`} />{comment.likeCount || "いいね"}</button></div></div>)}</div></section>;
}
