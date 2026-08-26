"use client";

import Link from "next/link";
import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { useState, useTransition } from "react";
import { Heart, Megaphone, MessageCircle, UserPlus, UserCheck, X } from "lucide-react";
import { deleteNotification } from "@/actions/notifications";
import type { NotificationType } from "@/types/database";

type ActorProfile = { id: string; full_name: string | null; avatar_url: string | null };

type NotificationItem = {
  id: string;
  type: NotificationType;
  link: string;
  preview_text: string | null;
  read_at: string | null;
  created_at: string;
  sender_label: string | null;
  actor: ActorProfile | null;
};

const ICON_BY_TYPE: Record<NotificationType, { icon: typeof Heart; className: string }> = {
  friend_request: { icon: UserPlus, className: "bg-primary text-primary-foreground" },
  friend_accept: { icon: UserCheck, className: "bg-primary text-primary-foreground" },
  event_like: { icon: Heart, className: "bg-primary text-primary-foreground" },
  event_comment: { icon: MessageCircle, className: "bg-info text-info-foreground" },
  event_comment_reply: { icon: MessageCircle, className: "bg-info text-info-foreground" },
  event_comment_like: { icon: Heart, className: "bg-primary text-primary-foreground" },
  announcement_comment: { icon: MessageCircle, className: "bg-info text-info-foreground" },
  announcement_comment_reply: { icon: MessageCircle, className: "bg-info text-info-foreground" },
  announcement_comment_like: { icon: Heart, className: "bg-primary text-primary-foreground" },
  ra_broadcast: { icon: Megaphone, className: "bg-primary text-primary-foreground" },
};

function actionText(type: NotificationType) {
  switch (type) {
    case "friend_request":
      return "友達申請を送りました";
    case "friend_accept":
      return "友達申請を承認しました";
    case "event_like":
      return "あなたのイベントにいいねしました";
    case "event_comment":
      return "あなたのイベントにコメントしました";
    case "event_comment_reply":
      return "あなたのコメントに返信しました";
    case "event_comment_like":
      return "あなたのコメントにいいねしました";
    case "announcement_comment":
      return "お知らせにコメントしました";
    case "announcement_comment_reply":
      return "あなたのコメントに返信しました";
    case "announcement_comment_like":
      return "あなたのコメントにいいねしました";
    case "ra_broadcast":
      return "お知らせを送信しました";
    default:
      return "";
  }
}

function displayName(notification: NotificationItem) {
  return notification.sender_label?.trim() || notification.actor?.full_name?.trim() || "WISH Events";
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}日前`;
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(value));
}

export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleDismiss(id: string) {
    setDismissedIds((current) => new Set(current).add(id));
    startTransition(async () => {
      const result = await deleteNotification(id);
      if (result?.error) {
        setDismissedIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    });
  }

  const visible = notifications.filter((n) => !dismissedIds.has(n.id));

  if (visible.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">通知はまだありません</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      {visible.map((notification) => {
        const { icon: Icon, className } = ICON_BY_TYPE[notification.type];
        const isUnread = !notification.read_at;
        return (
          <div
            key={notification.id}
            className={`group relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-secondary/40 ${
              isUnread ? "bg-primary/5" : ""
            }`}
          >
            <Link href={notification.link} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="relative shrink-0">
                <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-muted text-sm">
                  {notification.type === "ra_broadcast" && !notification.actor ? (
                    <Megaphone className="h-5 w-5 text-primary" aria-hidden />
                  ) : (
                    <Image
                      src={notification.actor?.avatar_url || DEFAULT_AVATAR_IMAGE_URL}
                      alt=""
                      width={44}
                      height={44}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <span
                  className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card ${className}`}
                >
                  <Icon className="h-3 w-3" />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sm leading-snug">
                  <span className="font-semibold">{displayName(notification)}</span>
                  {notification.type === "ra_broadcast" ? "からのお知らせ" : <>さんが{actionText(notification.type)}</>}
                </span>
                {notification.preview_text && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{notification.preview_text}</p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{formatRelativeTime(notification.created_at)}</p>
              </span>
              {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </Link>
            <button
              type="button"
              onClick={() => handleDismiss(notification.id)}
              aria-label="通知を削除"
              className="shrink-0 rounded-full p-1 text-muted-foreground/60 opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
