"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, ClipboardCheck, Copy, Heart, ImagePlus, Info, Loader2, Send, Smile, Sparkles, Vote, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createEventPoll,
  getEventMessagesByIds,
  getOlderEventMessages,
  markEventTalkRead,
  sendEventDetailsTool,
  sendEventSurveyTool,
  sendEventMessage,
  toggleEventMessageReaction,
  voteEventPoll,
} from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { ImageLightbox } from "@/components/community/image-lightbox";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { createClient } from "@/lib/supabase/client";
import { compressImageFile } from "@/lib/image-compress";

type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mediaUrl?: string | null;
  message_type: "text" | "image" | "tool" | "poll";
  action_url: string | null;
  action_label: string | null;
  poll_id?: string | null;
  sender: { full_name: string | null; avatar_url: string | null; role: string } | null;
};
type Reaction = { message_id: string; user_id: string; emoji: "❤️" | "👍" | "🎉" | "😂" | "👀" };
type Poll = { id: string; question: string; options: string[]; closes_at?: string | null };
type Vote = { poll_id: string; user_id: string; option_index: number };

const EMOJIS: Reaction["emoji"][] = ["❤️", "👍", "🎉", "😂", "👀"];
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const TAP_WINDOW_MS = 300;
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** 自サイト内のURLかどうか判定する（appOriginはサーバーから渡された絶対URLの起点）。 */
function internalPath(url: string, appOrigin: string): string | null {
  if (!appOrigin) return null;
  if (url === appOrigin) return "/";
  if (url.startsWith(`${appOrigin}/`)) return url.slice(appOrigin.length);
  return null;
}

function internalLinkLabel(path: string): string {
  if (path.includes("/survey")) return "アンケートに回答する";
  if (path.startsWith("/events/")) return "イベント詳細を見る";
  return "サイト内で開く";
}

/** メッセージ本文中のURLを、自サイト内なら綺麗なボタンに、それ以外は通常のリンクに変換する。 */
function linkifyText(text: string, keyPrefix: string, appOrigin: string) {
  return text.split(URL_PATTERN).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return <span key={`${keyPrefix}-${index}`}>{part}</span>;
    const path = internalPath(part, appOrigin);
    if (path) {
      return (
        <Link
          key={`${keyPrefix}-${index}`}
          href={path}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 inline-flex items-center gap-1 rounded-xl bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          {internalLinkLabel(path)}
        </Link>
      );
    }
    return (
      <a
        key={`${keyPrefix}-${index}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="break-all underline underline-offset-2"
      >
        {part}
      </a>
    );
  });
}

/** 3行以上連続する空行を2行までに詰める（メッセージ後の不自然な空欄対策）。 */
function normalizeBody(text: string) {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** 直前・直後のメッセージと同じ送信者・近い時刻かどうか（IG DM風のグルーピング用）。 */
function isSameGroup(a: Message | undefined, b: Message | undefined) {
  if (!a || !b) return false;
  if (a.sender_id !== b.sender_id) return false;
  return Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_WINDOW_MS;
}

export function EventTalk({
  eventId,
  currentUserId,
  messages,
  reactions,
  polls,
  votes,
  hasMoreOlder = false,
  isRa,
  appOrigin = "",
}: {
  eventId: string;
  currentUserId: string;
  messages: Message[];
  reactions: Reaction[];
  polls: Poll[];
  votes: Vote[];
  hasMoreOlder?: boolean;
  isRa: boolean;
  appOrigin?: string;
}) {
  const [liveMessages, setLiveMessages] = useState<Message[]>(messages);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [reactionState, setReactionState] = useState(reactions);
  const [voteState, setVoteState] = useState(votes);
  const [pollsState, setPollsState] = useState(polls);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [heartPulseId, setHeartPulseId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasMoreOlderState, setHasMoreOlderState] = useState(hasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tapTimerRef = useRef<Map<string, number>>(new Map());
  const heartTimerRef = useRef<number | null>(null);
  const initialScrollDone = useRef(false);
  const router = useRouter();

  const displayedMessages = useMemo(
    () => [...liveMessages, ...optimisticMessages.filter((m) => !liveMessages.some((saved) => saved.id === m.id))],
    [liveMessages, optimisticMessages]
  );
  const pollsById = useMemo(() => new Map(pollsState.map((poll) => [poll.id, poll])), [pollsState]);

  function scrollToBottom(smooth = true) {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }

  useEffect(() => {
    if (initialScrollDone.current) return;
    initialScrollDone.current = true;
    scrollToBottom(false);
  }, []);

  // 他の人からの新着メッセージだけを取得して直接末尾に追加する。
  // 以前はrouter.refresh()でページ全体（全履歴・全プロフィール・署名URL等）を
  // 再取得していたため、会話が長いイベントほどトークが重くなっていた。
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-talk-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as { id: string; sender_id: string; message_type?: string; poll_id?: string | null };
          if (row.sender_id === currentUserId) return; // 自分の送信は楽観更新側で処理済み
          void (async () => {
            const { messages: fetched } = await getEventMessagesByIds(eventId, [row.id]);
            if (fetched.length === 0) return;
            setLiveMessages((current) => (current.some((m) => m.id === row.id) ? current : [...current, ...(fetched as Message[])]));
            if (row.message_type === "poll" && row.poll_id) {
              const supabase2 = createClient();
              const { data: poll } = await supabase2.from("event_polls").select("*").eq("id", row.poll_id).maybeSingle();
              if (poll) setPollsState((current) => (current.some((p) => p.id === poll.id) ? current : [...current, poll]));
            }
            scrollToBottom();
          })();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, currentUserId]);

  useEffect(() => {
    markEventTalkRead(eventId);
  }, [eventId, liveMessages.length]);

  useEffect(() => {
    return () => {
      if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
      tapTimerRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  async function loadOlder() {
    if (!hasMoreOlderState || loadingOlder || liveMessages.length === 0) return;
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    setLoadingOlder(true);
    const oldest = liveMessages[0].created_at;
    const res = await getOlderEventMessages(eventId, oldest, 40);
    setLiveMessages((current) => [...(res.messages as Message[]), ...current]);
    if (res.polls.length) setPollsState((current) => [...current, ...(res.polls as Poll[])]);
    if (res.votes.length) setVoteState((current) => [...current, ...(res.votes as Vote[])]);
    if (res.reactions.length) setReactionState((current) => [...current, ...(res.reactions as Reaction[])]);
    setHasMoreOlderState(res.hasMore);
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - prevHeight;
    });
  }

  const addOptimisticMessages = useCallback((rows: Message[]) => {
    setOptimisticMessages((current) => [...current, ...rows]);
    requestAnimationFrame(() => scrollToBottom());
  }, []);
  const resolveOptimisticMessages = useCallback((tempIds: string[], realRows: Message[]) => {
    setOptimisticMessages((current) =>
      current.map((m) => {
        const idx = tempIds.indexOf(m.id);
        return idx >= 0 && realRows[idx] ? { ...realRows[idx], mediaUrl: m.mediaUrl } : m;
      })
    );
  }, []);
  const revertOptimisticMessages = useCallback((tempIds: string[]) => {
    setOptimisticMessages((current) => current.filter((m) => !tempIds.includes(m.id)));
  }, []);

  function react(messageId: string, emoji: Reaction["emoji"]) {
    const active = reactionState.some(
      (reaction) => reaction.message_id === messageId && reaction.user_id === currentUserId && reaction.emoji === emoji
    );
    setReactionState((current) =>
      active
        ? current.filter(
            (reaction) => !(reaction.message_id === messageId && reaction.user_id === currentUserId && reaction.emoji === emoji)
          )
        : [...current, { message_id: messageId, user_id: currentUserId, emoji }]
    );
    void toggleEventMessageReaction(messageId, emoji, active).then((result) => {
      if (result?.error) setError(result.error);
    });
  }

  function quickReact(messageId: string) {
    const alreadyLiked = reactionState.some(
      (reaction) => reaction.message_id === messageId && reaction.user_id === currentUserId && reaction.emoji === "❤️"
    );
    if (!alreadyLiked) react(messageId, "❤️");
    setHeartPulseId(messageId);
    if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
    heartTimerRef.current = window.setTimeout(() => setHeartPulseId((current) => (current === messageId ? null : current)), 700);
  }

  /**
   * バブルのタップ操作: シングルタップ→メニュー（コピー・リアクション）or 画像なら拡大表示、
   * ダブルタップ→即❤️リアクション（Instagram DM風）。
   */
  function handleBubbleTap(message: Message, kind: "text" | "image") {
    const pendingTimer = tapTimerRef.current.get(message.id);
    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      tapTimerRef.current.delete(message.id);
      quickReact(message.id);
      return;
    }
    const timer = window.setTimeout(() => {
      tapTimerRef.current.delete(message.id);
      if (kind === "image" && message.mediaUrl) {
        setLightboxUrl(message.mediaUrl);
      } else {
        setOpenMenuId((current) => (current === message.id ? null : message.id));
      }
    }, TAP_WINDOW_MS);
    tapTimerRef.current.set(message.id, timer);
  }

  async function copyMessageText(message: Message) {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1500);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  function castVote(pollId: string, optionIndex: number) {
    const oldVote = voteState.find((vote) => vote.poll_id === pollId && vote.user_id === currentUserId);
    setVoteState((current) => [
      ...current.filter((vote) => !(vote.poll_id === pollId && vote.user_id === currentUserId)),
      { poll_id: pollId, user_id: currentUserId, option_index: optionIndex },
    ]);
    void voteEventPoll(pollId, optionIndex).then((result) => {
      if (result?.error) {
        setError(result.error);
        setVoteState((current) => [
          ...current.filter((vote) => !(vote.poll_id === pollId && vote.user_id === currentUserId)),
          ...(oldVote ? [oldVote] : []),
        ]);
      }
    });
  }

  const time = (createdAt: string) =>
    new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f8] sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-sm">
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#f5e9ef_0%,#fafafa_42%,#f8f7f8_100%)] px-3.5 py-5 sm:min-h-[20rem] sm:px-4"
      >
        {hasMoreOlderState && (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="mb-2 inline-flex items-center gap-1.5 self-center rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:bg-secondary disabled:opacity-60"
          >
            {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}
            過去のメッセージを読み込む
          </button>
        )}
        <div className="mb-2 self-center rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
          イベントに関するお知らせと会話
        </div>
        {displayedMessages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const prev = displayedMessages[index - 1];
          const next = displayedMessages[index + 1];
          const isGroupStart = !isSameGroup(prev, message);
          const isGroupEnd = !isSameGroup(message, next);
          const messageReactions = reactionState.filter((reaction) => reaction.message_id === message.id);
          const reactionGroups = EMOJIS.map((emoji) => ({
            emoji,
            count: messageReactions.filter((reaction) => reaction.emoji === emoji).length,
            active: messageReactions.some((reaction) => reaction.emoji === emoji && reaction.user_id === currentUserId),
          })).filter((reaction) => reaction.count > 0);
          const poll = message.poll_id ? pollsById.get(message.poll_id) : undefined;
          const hasCaption = !!message.body;
          const bubbleTail = mine
            ? isGroupEnd
              ? "rounded-br-md"
              : "rounded-br-2xl"
            : isGroupEnd
              ? "rounded-bl-md"
              : "rounded-bl-2xl";
          const bubbleBase = `rounded-[22px] ${bubbleTail} px-3.5 py-2.5 shadow-[0_2px_10px_rgba(44,24,34,0.08)] ${
            mine
              ? "bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--primary)/0.82))] text-primary-foreground"
              : "border border-white/80 bg-[linear-gradient(145deg,#ffffff,#fbf8fa)] text-foreground"
          }`;

          return (
            <div
              key={message.id}
              className={`group flex max-w-[91%] gap-2 motion-safe:animate-fade-in ${mine ? "self-end" : "self-start"} ${
                isGroupStart && index !== 0 ? "mt-3" : ""
              }`}
            >
              {!mine &&
                (isGroupEnd ? (
                  <Link href={`/directory/${message.sender_id}`} className="mt-1 self-end shrink-0">
                    <AvatarRing role={message.sender?.role} size={28}>
                      {message.sender?.avatar_url ? (
                        <Image
                          src={message.sender.avatar_url}
                          alt=""
                          width={28}
                          height={28}
                          className="h-7 w-7 rounded-full object-cover shadow-sm"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs shadow-sm">
                          {message.sender?.full_name?.charAt(0) ?? "?"}
                        </span>
                      )}
                    </AvatarRing>
                  </Link>
                ) : (
                  <span className="w-7 shrink-0" />
                ))}
              <div className="relative min-w-0">
                {!mine && isGroupStart && (
                  <Link
                    href={`/directory/${message.sender_id}`}
                    className="mb-1 flex w-fit items-center pl-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {message.sender?.full_name ?? "RA"}
                    {message.sender?.role === "ra" && (
                      <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">RA</span>
                    )}
                  </Link>
                )}

                {message.mediaUrl ? (
                  // 写真メッセージは吹き出しの背景色を持たず、画像そのものを浮かせて表示する（Instagram DM風）。
                  <div
                    className="relative w-fit max-w-full cursor-pointer select-none overflow-hidden rounded-[20px] shadow-[0_2px_12px_rgba(44,24,34,0.14)]"
                    onClick={() => handleBubbleTap(message, "image")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.mediaUrl}
                      alt="トークに送信された画像"
                      loading="lazy"
                      decoding="async"
                      className="block max-h-80 min-w-40 rounded-[20px] object-cover"
                    />
                    {heartPulseId === message.id && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <Heart className="h-16 w-16 fill-white text-white drop-shadow-lg motion-safe:animate-heart-pop" />
                      </span>
                    )}
                  </div>
                ) : message.message_type === "tool" && message.action_url ? (
                  <ToolCard message={message} appOrigin={appOrigin} />
                ) : poll ? (
                  <PollCard poll={poll} votes={voteState.filter((vote) => vote.poll_id === poll.id)} currentUserId={currentUserId} onVote={castVote} />
                ) : (
                  <div className={`relative ${bubbleBase}`} onClick={() => handleBubbleTap(message, "text")}>
                    <p className="cursor-pointer select-none whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                      {linkifyText(normalizeBody(message.body), `${message.id}-body`, appOrigin)}
                    </p>
                  </div>
                )}

                {message.mediaUrl && hasCaption && (
                  <p className="mt-1 whitespace-pre-wrap break-words px-0.5 text-[13px] leading-snug text-foreground/80">
                    {linkifyText(normalizeBody(message.body), `${message.id}-caption`, appOrigin)}
                  </p>
                )}

                {reactionGroups.length > 0 && (
                  <div className={`mt-1 flex flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                    {reactionGroups.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        type="button"
                        onClick={() => react(message.id, reaction.emoji)}
                        className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] shadow-sm transition-transform active:scale-90 ${
                          reaction.active ? "border-primary/40 bg-primary/10" : "border-border bg-card"
                        }`}
                      >
                        <span>{reaction.emoji}</span>
                        <span>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {isGroupEnd && <div className={`mt-1 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}><span className="text-[10px] font-medium text-muted-foreground/70">{time(message.created_at)}</span></div>}

                {openMenuId === message.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                    <div
                      className={`absolute bottom-full z-50 mb-1 flex items-center gap-0.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-elevated motion-safe:animate-pop-in ${
                        mine ? "right-0" : "left-0"
                      }`}
                    >
                      {hasCaption && !message.mediaUrl && (
                        <>
                          <button
                            type="button"
                            aria-label="コピー"
                            onClick={() => {
                              void copyMessageText(message);
                            }}
                            className="rounded-full p-1.5 text-muted-foreground transition-transform hover:scale-110 active:scale-90"
                          >
                            {copiedId === message.id ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <span className="mx-0.5 h-4 w-px bg-border" />
                        </>
                      )}
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`${emoji}でリアクション`}
                          onClick={() => {
                            react(message.id, emoji);
                            setOpenMenuId(null);
                          }}
                          className="rounded-full p-1 text-lg leading-none transition-transform hover:scale-125 active:scale-90"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <Composer
        eventId={eventId}
        currentUserId={currentUserId}
        isRa={isRa}
        onOptimisticAdd={addOptimisticMessages}
        onOptimisticResolve={resolveOptimisticMessages}
        onOptimisticRevert={revertOptimisticMessages}
        externalError={error}
        onDismissExternalError={() => setError(null)}
      />
      {lightboxUrl && <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

function Composer({
  eventId,
  currentUserId,
  isRa,
  onOptimisticAdd,
  onOptimisticResolve,
  onOptimisticRevert,
  externalError,
  onDismissExternalError,
}: {
  eventId: string;
  currentUserId: string;
  isRa: boolean;
  onOptimisticAdd: (rows: Message[]) => void;
  onOptimisticResolve: (tempIds: string[], realRows: Message[]) => void;
  onOptimisticRevert: (tempIds: string[]) => void;
  externalError: string | null;
  onDismissExternalError: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [stagedImages, setStagedImages] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const [toolOpen, setToolOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const router = useRouter();
  const shownError = error ?? externalError;

  function addStagedFiles(files: File[]) {
    setError(null);
    const room = Math.max(0, 6 - stagedImages.length);
    const oversized = files.some((f) => f.size > 8 * 1024 * 1024);
    if (oversized) setError("8MBを超える画像は追加できません");
    const accepted = files.filter((f) => f.size <= 8 * 1024 * 1024).slice(0, room);
    // ストレージ・通信量の節約のため、送信前にブラウザ側で縮小・再圧縮する
    // （寮生800人超が使う無料枠を長持ちさせるための対策。詳細はcompressImageFile参照）。
    void (async () => {
      for (const file of accepted) {
        const compressed = await compressImageFile(file);
        const item = { id: crypto.randomUUID(), file: compressed, previewUrl: URL.createObjectURL(compressed) };
        setStagedImages((current) => [...current, item]);
      }
    })();
  }

  function removeStagedImage(id: string) {
    setStagedImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  function handleSend() {
    const text = body.trim();
    if (!text && stagedImages.length === 0) return;
    setError(null);
    onDismissExternalError();

    if (stagedImages.length === 0) {
      setBody("");
      const tempId = `pending-${crypto.randomUUID()}`;
      onOptimisticAdd([
        {
          id: tempId,
          sender_id: currentUserId,
          body: text,
          created_at: new Date().toISOString(),
          mediaUrl: null,
          message_type: "text",
          action_url: null,
          action_label: null,
          sender: null,
        },
      ]);
      startTransition(async () => {
        const result = await sendEventMessage(eventId, text, []);
        if (result?.error) {
          onOptimisticRevert([tempId]);
          setBody(text);
          setError(result.error);
        } else {
          const real = (result.messages ?? [])[0];
          if (real) onOptimisticResolve([tempId], [{ ...real, mediaUrl: null, sender: null }]);
        }
      });
      return;
    }

    const staged = stagedImages;
    setStagedImages([]);
    setBody("");
    setUploading(true);
    void (async () => {
      const supabase = createClient();
      const uploadedPaths: (string | null)[] = [];
      for (const item of staged) {
        const ext = item.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("event-chat-media")
          .upload(path, item.file, { contentType: item.file.type, upsert: false });
        uploadedPaths.push(uploadError ? null : path);
      }
      setUploading(false);
      const okIndexes = uploadedPaths
        .map((path, index) => ({ path, index }))
        .filter((entry): entry is { path: string; index: number } => !!entry.path);
      if (okIndexes.length === 0) {
        setError("画像の送信に失敗しました");
        return;
      }
      const okPaths = okIndexes.map((entry) => entry.path);
      const okStaged = okIndexes.map((entry) => staged[entry.index]);
      const tempIds = okStaged.map(() => `pending-${crypto.randomUUID()}`);
      onOptimisticAdd(
        okStaged.map((item, i) => ({
          id: tempIds[i],
          sender_id: currentUserId,
          body: i === 0 ? text : "",
          created_at: new Date(Date.now() + i).toISOString(),
          mediaUrl: item.previewUrl,
          message_type: "image",
          action_url: null,
          action_label: null,
          sender: null,
        }))
      );
      startTransition(async () => {
        const result = await sendEventMessage(eventId, text, okPaths);
        if (result?.error) {
          onOptimisticRevert(tempIds);
          setError(result.error);
        } else {
          const real = result.messages ?? [];
          onOptimisticResolve(
            tempIds,
            real.map((row, i) => ({ ...row, mediaUrl: okStaged[i]?.previewUrl ?? null, sender: null }))
          );
        }
      });
    })();
  }

  function createPoll() {
    startTransition(async () => {
      const result = await createEventPoll(eventId, pollQuestion, pollOptions);
      if (result?.error) {
        setError(result.error);
      } else {
        setPollQuestion("");
        setPollOptions(["", ""]);
        setPollOpen(false);
        setToolOpen(false);
        router.refresh();
      }
    });
  }

  function sendTool(action: () => Promise<{ message?: unknown; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
      } else if (result?.message) {
        onOptimisticAdd([{ ...(result.message as Message), mediaUrl: null, sender: null }]);
        setToolOpen(false);
      }
    });
  }

  return (
    <div className="border-t border-border/80 bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <PendingFeedback active={pending || uploading} label={uploading ? "画像を送信しています…" : "メッセージを送信しています…"} />
      {isRa && (
        <div className="mb-2">
          <button
            type="button"
            onClick={() => setToolOpen((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            <Sparkles className="h-3.5 w-3.5" />
            ツール
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolOpen ? "rotate-180" : ""}`} />
          </button>
          {toolOpen && (
            <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background p-2 shadow-lg">
              <button
                type="button"
                disabled={pending}
                onClick={() => sendTool(() => sendEventSurveyTool(eventId))}
                className="rounded-xl p-2 text-left text-xs font-semibold hover:bg-secondary"
              >
                <Smile className="mb-1 h-4 w-4 text-primary" />
                アンケート
              </button>
              <button
                type="button"
                onClick={() => setPollOpen((open) => !open)}
                className="rounded-xl p-2 text-left text-xs font-semibold hover:bg-secondary"
              >
                <BarChart3 className="mb-1 h-4 w-4 text-primary" />
                投票
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => sendTool(() => sendEventDetailsTool(eventId))}
                className="rounded-xl p-2 text-left text-xs font-semibold hover:bg-secondary"
              >
                <Info className="mb-1 h-4 w-4 text-primary" />
                詳細案内
              </button>
            </div>
          )}
          {pollOpen && (
            <div className="mt-2 rounded-2xl border border-border bg-background p-3 shadow-lg">
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="投票の質問"
                maxLength={300}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={(e) =>
                    setPollOptions((current) => current.map((item, itemIndex) => (itemIndex === index ? e.target.value : item)))
                  }
                  placeholder={`選択肢 ${index + 1}`}
                  maxLength={120}
                  className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                />
              ))}
              <div className="mt-2 flex justify-between">
                <button
                  type="button"
                  disabled={pollOptions.length >= 4}
                  onClick={() => setPollOptions((current) => [...current, ""])}
                  className="text-xs font-semibold text-primary disabled:opacity-40"
                >
                  ＋ 選択肢を追加
                </button>
                <Button size="sm" disabled={pending} onClick={createPoll}>
                  投票を送る
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {stagedImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {stagedImages.map((item) => (
            <div key={item.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeStagedImage(item.id)}
                aria-label="削除"
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 rounded-[22px] border border-border bg-secondary/45 px-2 py-1.5 shadow-inner">
        <label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background">
          <ImagePlus className="h-5 w-5" />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            disabled={uploading || stagedImages.length >= 6}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) addStagedFiles(files);
              e.target.value = "";
            }}
          />
        </label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // IME変換確定のEnterまで送信してしまい、テキスト欄に変換途中の
            // 文字が残る不具合があったため、isComposing中は無視する。
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={uploading ? "画像を送信中…" : "メッセージ..."}
          className="min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full shadow-sm transition-transform active:scale-90"
          disabled={pending || uploading || (!body.trim() && stagedImages.length === 0)}
          onClick={handleSend}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {shownError && <p className="mt-1.5 px-1 text-xs text-destructive">{shownError}</p>}
    </div>
  );
}

function ToolCard({ message, appOrigin }: { message: Message; appOrigin: string }) {
  const rawUrl = message.action_url!;
  const localPath = rawUrl.startsWith("/") ? rawUrl : internalPath(rawUrl, appOrigin);
  const isSurvey = rawUrl.includes("survey") || message.action_label?.includes("アンケート");
  const Icon = isSurvey ? ClipboardCheck : CalendarDays;
  const content = <><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-bold tracking-[0.16em] text-primary">{isSurvey ? "EVENT SURVEY" : "EVENT GUIDE"}</span><span className="block text-sm font-bold">{message.action_label ?? "開く"}</span>{message.body && <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{message.body}</span>}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"><ArrowUpRight className="h-4 w-4" /></span></>;
  const className = "flex w-[min(78vw,340px)] items-center gap-3 rounded-[22px] border border-primary/15 bg-[linear-gradient(145deg,#ffffff_0%,hsl(var(--primary)/0.06)_100%)] p-3.5 text-left shadow-[0_8px_30px_rgba(69,25,46,0.10)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(69,25,46,0.14)] active:scale-[0.985]";
  return localPath ? <Link href={localPath} className={className}>{content}</Link> : <a href={rawUrl} target="_blank" rel="noreferrer" className={className}>{content}</a>;
}

function PollCard({
  poll,
  votes,
  currentUserId,
  onVote,
}: {
  poll: Poll;
  votes: Vote[];
  currentUserId: string;
  onVote: (pollId: string, optionIndex: number) => void;
}) {
  const selected = votes.find((vote) => vote.user_id === currentUserId)?.option_index;
  const total = votes.length;

  return (
    <div className="w-[min(78vw,340px)] overflow-hidden rounded-[22px] border border-primary/15 bg-card text-foreground shadow-[0_8px_30px_rgba(69,25,46,0.10)]">
      <div className="flex items-center justify-between bg-[linear-gradient(135deg,hsl(var(--primary)/0.12),hsl(var(--primary)/0.03))] px-4 py-3"><div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-primary"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Vote className="h-4 w-4" /></span>QUICK POLL</div>{total > 0 && <span className="rounded-full bg-card/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">{total}票</span>}</div>
      <div className="p-4"><p className="mb-3 text-[15px] font-bold leading-snug">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((option, index) => {
          const count = votes.filter((vote) => vote.option_index === index).length;
          const percentage = total ? Math.round((count / total) * 100) : 0;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onVote(poll.id, index)}
              className={`relative flex w-full items-center overflow-hidden rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-[transform,border-color] active:scale-[0.98] ${
                selected === index ? "border-primary/50 bg-primary/[0.04]" : "border-border/70 bg-background hover:border-primary/25"
              }`}
            >
              <span className="absolute inset-y-0 left-0 bg-primary/12 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
              <span className="relative flex-1">{option}</span>
              {selected === index && <Check className="relative mr-1 h-3.5 w-3.5 text-primary" />}
              <span className="relative text-muted-foreground">{selected !== undefined ? `${percentage}%` : "投票"}</span>
            </button>
          );
        })}
      </div>
      {selected !== undefined && <p className="mt-2.5 text-[10px] text-muted-foreground">選択済み · いつでも変更できます</p>}</div>
    </div>
  );
}
