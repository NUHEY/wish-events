"use client";

import { Heart, MessageCircleReply, Send } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addEventComment, toggleEventCommentLike } from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Comment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  user: { full_name: string | null; avatar_url: string | null; role: string } | null;
  likeCount: number;
  likedByMe: boolean;
};

export function EventComments({ eventId, comments }: { eventId: string; comments: Comment[] }) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sendingRef = useRef(false);
  const router = useRouter();

  const roots = comments.filter((comment) => !comment.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  comments
    .filter((comment) => comment.parent_id)
    .forEach((comment) => {
      const replies = repliesByParent.get(comment.parent_id!) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parent_id!, replies);
    });

  function submit() {
    if (sendingRef.current || !body.trim()) return;
    sendingRef.current = true;
    setError(null);
    startTransition(async () => {
      const result = await addEventComment(eventId, body, replyTo?.id);
      sendingRef.current = false;
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody("");
      setReplyTo(null);
      // Server Action の再検証結果を利用するため、ここで追加の refresh は行わない。
    });
  }

  function like(commentId: string, likedByMe: boolean) {
    startTransition(() => toggleEventCommentLike(commentId, eventId, likedByMe).then(() => router.refresh()));
  }

  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
      new Date(value)
    );

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 className="font-bold">コメント</h2>
      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
            <span className="truncate">{displayName(replyTo)} さんに返信</span>
            <button type="button" onClick={() => setReplyTo(null)} className="font-semibold">
              取消
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder={replyTo ? "返信を入力" : "イベントについてコメントする"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button size="icon" disabled={pending || !body.trim()} onClick={submit} aria-label="コメントを送信">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col gap-4">
        {roots.map((comment) => (
          <div key={comment.id} className="flex flex-col gap-2">
            <CommentItem
              comment={comment}
              formatTime={formatTime}
              onReply={() => {
                setReplyTo(comment);
                setBody("");
              }}
              onLike={() => like(comment.id, comment.likedByMe)}
            />
            {(repliesByParent.get(comment.id) ?? []).map((reply) => (
              <div key={reply.id} className="ml-7 border-l border-border pl-3 sm:ml-10">
                <CommentItem comment={reply} formatTime={formatTime} reply onLike={() => like(reply.id, reply.likedByMe)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      {roots.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">最初のコメントを投稿しましょう。</p>}
    </section>
  );
}

function CommentItem({
  comment,
  formatTime,
  onReply,
  onLike,
  reply = false,
}: {
  comment: Comment;
  formatTime: (value: string) => string;
  onReply?: () => void;
  onLike: () => void;
  reply?: boolean;
}) {
  const isRa = comment.user?.role?.toLowerCase() === "ra";

  return (
    <div className="flex gap-2">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs">
        {comment.user?.avatar_url ? (
          <Image src={comment.user.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          displayName(comment).charAt(0)
        )}
        {isRa && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-primary" />}
      </span>
      <div className="min-w-0 flex-1 rounded-2xl bg-secondary/45 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold">
            {displayName(comment)}
            {isRa && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">RA</span>}
          </p>
          <p className="shrink-0 text-[10px] text-muted-foreground">{formatTime(comment.created_at)}</p>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{comment.body}</p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onLike}
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              comment.likedByMe ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${comment.likedByMe ? "fill-current" : ""}`} />
            {comment.likeCount || "いいね"}
          </button>
          {!reply && (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <MessageCircleReply className="h-3.5 w-3.5" />
              返信
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function displayName(comment: Comment) {
  return comment.user?.full_name?.trim() || "名前未登録";
}
