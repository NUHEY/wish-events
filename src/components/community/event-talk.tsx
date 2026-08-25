"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BarChart3, ChevronDown, Heart, ImagePlus, Info, Send, Smile, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createEventPoll,
  markEventTalkRead,
  prepareEventDetailsToolDraft,
  prepareEventSurveyToolDraft,
  sendEventMessage,
  toggleEventMessageReaction,
  voteEventPoll,
} from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { createClient } from "@/lib/supabase/client";

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
const DOUBLE_TAP_MS = 320;
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** メッセージ本文中のURLをタップ可能なリンクに変換する。 */
function linkifyText(text: string, keyPrefix: string) {
  return text.split(URL_PATTERN).map((part, index) =>
    /^https?:\/\//.test(part) ? (
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
    ) : (
      <span key={`${keyPrefix}-${index}`}>{part}</span>
    )
  );
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
  isRa,
}: {
  eventId: string;
  currentUserId: string;
  messages: Message[];
  reactions: Reaction[];
  polls: Poll[];
  votes: Vote[];
  isRa: boolean;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [reactionState, setReactionState] = useState(reactions);
  const [voteState, setVoteState] = useState(votes);
  const [toolOpen, setToolOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);
  const [heartPulseId, setHeartPulseId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<Map<string, number>>(new Map());
  const heartTimerRef = useRef<number | null>(null);
  const router = useRouter();

  const displayedMessages = useMemo(
    () => [...messages, ...optimisticMessages.filter((message) => !messages.some((saved) => saved.id === message.id))],
    [messages, optimisticMessages]
  );
  const pollsById = useMemo(() => new Map(polls.map((poll) => [poll.id, poll])), [polls]);

  useEffect(() => setReactionState(reactions), [reactions]);
  useEffect(() => setVoteState(votes), [votes]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`event-talk-${eventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` },
        (payload) => {
          // 自分が送ったメッセージはsubmit()側のrefreshで既に反映済みのため、
          // 他の人からの新着メッセージのときだけrefreshする（二重refresh防止）。
          const senderId = (payload.new as { sender_id?: string } | null)?.sender_id;
          if (senderId !== currentUserId) router.refresh();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, router, currentUserId]);
  useEffect(() => {
    markEventTalkRead(eventId);
  }, [eventId, messages.length]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [displayedMessages.length]);
  useEffect(() => {
    return () => {
      if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
    };
  }, []);

  function addOptimisticMessage(message: Message) {
    setOptimisticMessages((current) => [...current, message]);
    setTimeout(() => setOptimisticMessages((current) => current.filter((item) => item.id !== message.id)), 9000);
  }

  function submit(mediaPath?: string, localMediaUrl?: string) {
    const text = body.trim();
    if (!text && !mediaPath) return;
    setBody("");
    setError(null);
    const tempId = `pending-${crypto.randomUUID()}`;
    addOptimisticMessage({
      id: tempId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
      mediaUrl: localMediaUrl ?? null,
      message_type: mediaPath ? "image" : "text",
      action_url: null,
      action_label: null,
      sender: null,
    });
    startTransition(async () => {
      const result = await sendEventMessage(eventId, text, mediaPath);
      if (result?.error) {
        setOptimisticMessages((current) => current.filter((message) => message.id !== tempId));
        setBody(text);
        setError(result.error);
      } else {
        setOptimisticMessages((current) =>
          current.map((message) => (message.id === tempId ? { ...message, id: result.message!.id } : message))
        );
        router.refresh();
      }
    });
  }

  async function uploadImage(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setError("画像は8MB以下にしてください");
      return;
    }
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const localMediaUrl = URL.createObjectURL(file);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("event-chat-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (uploadError) {
      URL.revokeObjectURL(localMediaUrl);
      setError(`画像の送信に失敗しました: ${uploadError.message}`);
      return;
    }
    submit(path, localMediaUrl);
  }

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
      if (result?.error) {
        setError(result.error);
        router.refresh();
      }
    });
  }

  /** ダブルタップ／ダブルクリックで即座に❤️リアクションを付ける（Instagram DM風）。 */
  function handleQuickReactTap(messageId: string) {
    const now = Date.now();
    const last = lastTapRef.current.get(messageId) ?? 0;
    if (now - last < DOUBLE_TAP_MS) {
      lastTapRef.current.delete(messageId);
      const alreadyLiked = reactionState.some(
        (reaction) => reaction.message_id === messageId && reaction.user_id === currentUserId && reaction.emoji === "❤️"
      );
      if (!alreadyLiked) react(messageId, "❤️");
      setHeartPulseId(messageId);
      if (heartTimerRef.current) window.clearTimeout(heartTimerRef.current);
      heartTimerRef.current = window.setTimeout(() => setHeartPulseId((current) => (current === messageId ? null : current)), 700);
    } else {
      lastTapRef.current.set(messageId, now);
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

  /**
   * RAツールのボタンは即送信せず、下書き文面をテキスト欄に入れるだけにする。
   * 内容を確認・編集してから、通常の送信ボタンで自分で送ってもらう。
   */
  function fillToolDraft(action: () => Promise<{ body?: string; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
      } else if (result?.body) {
        setBody(result.body);
        setToolOpen(false);
      }
    });
  }

  const time = (createdAt: string) =>
    new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f8] sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-sm">
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#f5e9ef_0%,#fafafa_42%,#f8f7f8_100%)] px-3.5 py-5 sm:max-h-[56vh] sm:min-h-[20rem] sm:px-4">
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
                    <AvatarRing role={message.sender?.role}>
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
                    onClick={() => handleQuickReactTap(message.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={message.mediaUrl}
                      alt="トークに送信された画像"
                      className="block max-h-80 min-w-40 rounded-[20px] object-cover"
                    />
                    {heartPulseId === message.id && (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <Heart className="h-16 w-16 fill-white text-white drop-shadow-lg motion-safe:animate-heart-pop" />
                      </span>
                    )}
                  </div>
                ) : message.message_type === "tool" && message.action_url ? (
                  <div className={bubbleBase}>
                    {hasCaption && (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {linkifyText(normalizeBody(message.body), `${message.id}-body`)}
                      </p>
                    )}
                    <a
                      href={message.action_url}
                      target={message.action_url.startsWith("http") ? "_blank" : undefined}
                      rel="noreferrer"
                      className="mt-2 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95"
                    >
                      {message.action_label ?? "開く"}
                    </a>
                  </div>
                ) : poll ? (
                  <div className={bubbleBase}>
                    {hasCaption && (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {linkifyText(normalizeBody(message.body), `${message.id}-body`)}
                      </p>
                    )}
                    <PollCard poll={poll} votes={voteState.filter((vote) => vote.poll_id === poll.id)} currentUserId={currentUserId} onVote={castVote} />
                  </div>
                ) : (
                  <div className={`relative ${bubbleBase}`} onClick={() => handleQuickReactTap(message.id)}>
                    <p className="cursor-pointer select-none whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                      {linkifyText(normalizeBody(message.body), `${message.id}-body`)}
                    </p>
                  </div>
                )}

                {message.mediaUrl && hasCaption && (
                  <p className="mt-1 whitespace-pre-wrap break-words px-0.5 text-[13px] leading-snug text-foreground/80">
                    {linkifyText(normalizeBody(message.body), `${message.id}-caption`)}
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

                <div className={`mt-1 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                  <span className="text-[10px] font-medium text-muted-foreground/70">{time(message.created_at)}</span>
                  <button
                    type="button"
                    aria-label="リアクションを追加"
                    onClick={() => setOpenPickerId((current) => (current === message.id ? null : message.id))}
                    className="rounded-full p-1 text-muted-foreground/50 opacity-60 transition-all hover:bg-secondary/70 hover:text-primary hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                </div>

                {openPickerId === message.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpenPickerId(null)} />
                    <div
                      className={`absolute bottom-full z-50 mb-1 flex gap-0.5 rounded-full border border-border bg-card px-2 py-1.5 shadow-elevated motion-safe:animate-pop-in ${
                        mine ? "right-0" : "left-0"
                      }`}
                    >
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          aria-label={`${emoji}でリアクション`}
                          onClick={() => {
                            react(message.id, emoji);
                            setOpenPickerId(null);
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
      <div className="border-t border-border/80 bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        {isRa && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setToolOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <Sparkles className="h-3.5 w-3.5" />
              ツール
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolOpen ? "rotate-180" : ""}`} />
            </button>
            {toolOpen && (
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background p-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => fillToolDraft(() => prepareEventSurveyToolDraft(eventId))}
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
                  onClick={() => fillToolDraft(() => prepareEventDetailsToolDraft(eventId))}
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
        <div className="flex items-end gap-1.5 rounded-[22px] border border-border bg-secondary/45 px-2 py-1.5 shadow-inner">
          <label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background">
            <ImagePlus className="h-5 w-5" />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImage(file);
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
                submit();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={uploading ? "画像を送信中…" : "メッセージ..."}
            className="min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0"
          />
          <Smile className="mb-2 h-5 w-5 shrink-0 text-muted-foreground" />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full shadow-sm transition-transform active:scale-90"
            disabled={pending || uploading || !body.trim()}
            onClick={() => submit()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
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
    <div className="mt-2 min-w-60 rounded-2xl bg-black/5 p-2.5 text-foreground">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold">
        <BarChart3 className="h-4 w-4 text-primary" />
        投票
      </div>
      <p className="mb-2 text-sm font-semibold">{poll.question}</p>
      <div className="space-y-1.5">
        {poll.options.map((option, index) => {
          const count = votes.filter((vote) => vote.option_index === index).length;
          const percentage = total ? Math.round((count / total) * 100) : 0;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onVote(poll.id, index)}
              className={`relative flex w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-medium transition-transform active:scale-[0.98] ${
                selected === index ? "border-primary/50" : "border-border/70 bg-card/80"
              }`}
            >
              <span className="absolute inset-y-0 left-0 bg-primary/12 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
              <span className="relative flex-1">{option}</span>
              <span className="relative text-muted-foreground">{selected !== undefined ? `${percentage}%` : "投票"}</span>
            </button>
          );
        })}
      </div>
      {selected !== undefined && <p className="mt-2 text-[10px] text-muted-foreground">{total}票 · 選択を変更できます</p>}
    </div>
  );
}
