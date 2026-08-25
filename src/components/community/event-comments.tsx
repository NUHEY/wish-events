"use client";

import { Heart, MessageCircleReply, Send, Trash2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addEventComment, deleteEventComment, toggleEventCommentLike } from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { PendingFeedback } from "@/components/ui/pending-feedback";

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

export function EventComments({
  eventId,
  comments,
  currentUserId,
  isRa,
}: {
  eventId: string;
  comments: Comment[];
  currentUserId: string;
  isRa: boolean;
}) {
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(new Set());
  // いいねは即時反映するため、サーバーの再取得を待たずにこのオーバーライドで表示を上書きする。
  const [likeOverrides, setLikeOverrides] = useState<Record<string, { likedByMe: boolean; likeCount: number }>>({});
  const sendingRef = useRef(false);
  const router = useRouter();

  const visibleComments = useMemo(() => {
    return comments
      .filter((comment) => !deletedIds.has(comment.id))
      .map((comment) => (likeOverrides[comment.id] ? { ...comment, ...likeOverrides[comment.id] } : comment));
  }, [comments, deletedIds, likeOverrides]);
  const roots = visibleComments.filter((comment) => !comment.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  visibleComments
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
      if (replyTo) setExpandedRoots((current) => new Set(current).add(replyTo.id));
      setBody("");
      setReplyTo(null);
      // Server Action の再検証結果を利用するため、ここで追加の refresh は行わない。
    });
  }

  function like(commentId: string, likedByMe: boolean, likeCount: number) {
    const nextLiked = !likedByMe;
    const nextCount = Math.max(0, likeCount + (nextLiked ? 1 : -1));
    setLikeOverrides((current) => ({ ...current, [commentId]: { likedByMe: nextLiked, likeCount: nextCount } }));
    toggleEventCommentLike(commentId, eventId, likedByMe).catch(() => {
      setLikeOverrides((current) => ({ ...current, [commentId]: { likedByMe, likeCount } }));
    });
  }

  function toggleExpanded(rootId: string) {
    setExpandedRoots((current) => {
      const next = new Set(current);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }

  function handleDelete(comment: Comment) {
    if (!window.confirm("このコメントを削除しますか？")) return;
    setDeletedIds((current) => {
      const next = new Set(current);
      next.add(comment.id);
      // 返信付きの親コメントを削除した場合、返信もカスケード削除されるため見た目上も一緒に消す。
      comments.forEach((c) => {
        if (c.parent_id === comment.id) next.add(c.id);
      });
      return next;
    });
    startTransition(async () => {
      const result = await deleteEventComment(comment.id, eventId);
      if (result?.error) {
        setError(result.error);
        setDeletedIds((current) => {
          const next = new Set(current);
          next.delete(comment.id);
          return next;
        });
        router.refresh();
      } else {
        toast.success("コメントを削除しました");
      }
    });
  }

  const formatTime = (value: string) =>
    new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
      new Date(value)
    );

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <PendingFeedback active={pending} label={body.trim() ? "コメントを送信しています…" : "コメントを更新しています…"} />
      <h2 className="font-bold">コメント（{visibleComments.length}）</h2>
      <div>
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
            <span className="truncate">{displayName(replyTo)} さんに返信</span>
            <button type="button" onClick={() => setReplyTo(null)} className="font-semibold">
              取消
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 rounded-[22px] border border-border bg-secondary/45 px-2 py-1.5 shadow-inner">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder={replyTo ? "返信を入力..." : "コメントを追加..."}
            className="h-10 flex-1 border-0 bg-transparent px-2 text-[16px] shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button size="icon" className="h-9 w-9 shrink-0 rounded-full transition-transform active:scale-90" disabled={pending || !body.trim()} onClick={submit} aria-label="コメントを送信">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-col gap-5">
        {roots.map((comment) => {
          const replies = repliesByParent.get(comment.id) ?? [];
          const expanded = expandedRoots.has(comment.id);
          return (
            <div key={comment.id} className="flex flex-col gap-2 motion-safe:animate-fade-in">
              <CommentItem
                comment={comment}
                formatTime={formatTime}
                canDelete={comment.user_id === currentUserId || isRa}
                onReply={() => {
                  setReplyTo(comment);
                  setBody("");
                }}
                onLike={() => like(comment.id, comment.likedByMe, comment.likeCount)}
                onDelete={() => handleDelete(comment)}
              />
              {replies.length > 0 && (
                <div className="ml-9 flex flex-col gap-2 sm:ml-11">
                  {expanded ? (
                    <>
                      {replies.map((reply) => (
                        <CommentItem
                          key={reply.id}
                          comment={reply}
                          formatTime={formatTime}
                          reply
                          canDelete={reply.user_id === currentUserId || isRa}
                          onLike={() => like(reply.id, reply.likedByMe, reply.likeCount)}
                          onDelete={() => handleDelete(reply)}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(comment.id)}
                        className="w-fit text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        返信を隠す
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(comment.id)}
                      className="flex w-fit items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <span className="h-px w-6 bg-border" />
                      返信を{replies.length}件表示
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
  onDelete,
  canDelete,
  reply = false,
}: {
  comment: Comment;
  formatTime: (value: string) => string;
  onReply?: () => void;
  onLike: () => void;
  onDelete: () => void;
  canDelete: boolean;
  reply?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <AvatarRing role={comment.user?.role} size={32}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs">
          {comment.user?.avatar_url ? (
            <Image src={comment.user.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
          ) : (
            displayName(comment).charAt(0)
          )}
        </span>
      </AvatarRing>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed">
          <span className="font-semibold">{displayName(comment)}</span>
          <span className="ml-1.5 whitespace-pre-wrap break-words">{comment.body}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{formatTime(comment.created_at)}</span>
          {comment.likeCount > 0 && <span>いいね{comment.likeCount}件</span>}
          {!reply && (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground"
            >
              <MessageCircleReply className="h-3 w-3" />
              返信する
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 font-medium text-muted-foreground/80 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              削除
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onLike}
        aria-label="いいね"
        className="mt-0.5 shrink-0 rounded-full p-1 transition-transform active:scale-90"
      >
        <Heart
          className={`h-4 w-4 transition-colors ${comment.likedByMe ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      </button>
    </div>
  );
}

function displayName(comment: Comment) {
  return comment.user?.full_name?.trim() || "名前未登録";
}
