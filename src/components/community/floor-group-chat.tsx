"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import {
  getFloorMessagesByIds,
  getOlderFloorMessages,
  markFloorMessagesRead,
  sendFloorMessage,
  type FloorMember,
} from "@/actions/floor-messages";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { Button } from "@/components/ui/button";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Textarea } from "@/components/ui/textarea";
import { useInitialChatPosition } from "@/components/community/use-initial-chat-position";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import type { FloorMessageRow } from "@/types/database";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

function isSameGroup(a: FloorMessageRow | undefined, b: FloorMessageRow | undefined) {
  return !!a && !!b && a.sender_id === b.sender_id
    && Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_WINDOW_MS;
}

function linkifyText(text: string, keyPrefix: string) {
  return text.split(URL_PATTERN).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={`${keyPrefix}-${index}`} href={part} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">
        {part}
      </a>
    ) : <span key={`${keyPrefix}-${index}`}>{part}</span>
  );
}

export function FloorGroupChat({
  floorNumber,
  currentUserId,
  messages,
  members,
  hasMoreOlder = false,
  initialLastReadAt = null,
}: {
  floorNumber: number;
  currentUserId: string;
  messages: FloorMessageRow[];
  members: FloorMember[];
  hasMoreOlder?: boolean;
  initialLastReadAt?: string | null;
}) {
  const [liveMessages, setLiveMessages] = useState(messages);
  const [optimisticMessages, setOptimisticMessages] = useState<FloorMessageRow[]>([]);
  const [hasMore, setHasMore] = useState(hasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const displayedMessages = useMemo(
    () => [...liveMessages, ...optimisticMessages.filter((item) => !liveMessages.some((saved) => saved.id === item.id))],
    [liveMessages, optimisticMessages]
  );
  const { firstUnreadId, unreadMarkerRef } = useInitialChatPosition(
    messages,
    currentUserId,
    initialLastReadAt,
    scrollRef,
    endRef
  );
  const setScrollRef = useCallback((node: HTMLDivElement | null) => { scrollRef.current = node; }, []);

  function scrollToBottom(smooth = true) {
    endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`floor-group-${floorNumber}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "floor_messages", filter: `floor_number=eq.${floorNumber}` },
        (payload) => {
          const id = (payload.new as { id: string }).id;
          void (async () => {
            const result = await getFloorMessagesByIds([id]);
            const fetched = result.messages[0];
            if (!fetched) return;
            setLiveMessages((current) => current.some((message) => message.id === id) ? current : [...current, fetched]);
            setOptimisticMessages((current) => current.filter((message) => message.id !== id));
            requestAnimationFrame(() => scrollToBottom());
          })();
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [floorNumber]);

  useEffect(() => { void markFloorMessagesRead(); }, [liveMessages.length]);

  async function loadOlder() {
    if (!hasMore || loadingOlder || liveMessages.length === 0) return;
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setLoadingOlder(true);
    const result = await getOlderFloorMessages(liveMessages[0].created_at);
    setLiveMessages((current) => [...result.messages, ...current]);
    setHasMore(result.hasMore);
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (container) container.scrollTop = container.scrollHeight - previousHeight;
    });
  }

  function handleSend() {
    const text = body.trim();
    if (!text || pending) return;
    const temporaryId = `pending-${crypto.randomUUID()}`;
    const optimistic: FloorMessageRow = {
      id: temporaryId,
      floor_number: floorNumber,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };
    setBody("");
    setError(null);
    setOptimisticMessages((current) => [...current, optimistic]);
    requestAnimationFrame(() => scrollToBottom());
    startTransition(async () => {
      const result = await sendFloorMessage(text);
      if (result.error || !result.message) {
        setOptimisticMessages((current) => current.filter((message) => message.id !== temporaryId));
        setBody(text);
        setError(result.error ?? "送信できませんでした。");
        return;
      }
      setOptimisticMessages((current) => current.filter((message) => message.id !== temporaryId));
      setLiveMessages((current) => current.some((message) => message.id === result.message!.id)
        ? current
        : [...current, result.message!]);
    });
  }

  const formatTime = (value: string) => new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--chat-surface))] sm:rounded-b-2xl sm:border-x sm:border-b sm:border-border sm:bg-card sm:shadow-sm">
      <PendingFeedback active={pending || loadingOlder} label={loadingOlder ? "過去のメッセージを読み込んでいます…" : "メッセージを送信しています…"} />
      <div ref={setScrollRef} className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,hsl(var(--chat-gradient-start))_0%,hsl(var(--chat-gradient-middle))_42%,hsl(var(--chat-surface))_100%)] px-3.5 py-5 sm:min-h-[20rem] sm:px-4">
        {hasMore && <button type="button" onClick={loadOlder} disabled={loadingOlder} className="mb-2 inline-flex items-center gap-1.5 self-center rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm disabled:opacity-60">{loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}過去のメッセージを読み込む</button>}
        {displayedMessages.length === 0 && <div className="self-center rounded-full border border-border/70 bg-card/85 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">{floorNumber}Fのみんなにメッセージを送ってみましょう</div>}
        {displayedMessages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const member = membersById.get(message.sender_id);
          const previous = displayedMessages[index - 1];
          const next = displayedMessages[index + 1];
          const groupStart = !isSameGroup(previous, message);
          const groupEnd = !isSameGroup(message, next);
          return <Fragment key={message.id}>
            {message.id === firstUnreadId && <div ref={unreadMarkerRef} className="my-3 flex w-full items-center gap-2" role="separator" aria-label="ここから未読"><span className="h-px flex-1 bg-destructive/35" /><span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">ここから未読</span><span className="h-px flex-1 bg-destructive/35" /></div>}
            <div className={`flex max-w-[88%] gap-2 ${mine ? "self-end" : "self-start"} ${groupStart && index !== 0 ? "mt-3" : ""}`}>
              {!mine && (groupEnd ? <span className="mt-1 self-end shrink-0"><AvatarRing role={member?.role ?? "resident"} size={28}><Image src={member?.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /></AvatarRing></span> : <span className="w-7 shrink-0" />)}
              <div className="min-w-0">
                {!mine && groupStart && <p className="mb-1 px-1 text-[10px] font-semibold text-muted-foreground">{member?.full_name ?? "寮生"}{member?.room_number ? ` · ${member.room_number}` : ""}</p>}
                <div className={`rounded-xl px-3.5 py-2.5 shadow-[0_2px_10px_rgba(44,24,34,0.08)] ${groupEnd ? mine ? "rounded-br-md" : "rounded-bl-md" : ""} ${mine ? "bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--primary)/0.82))] text-primary-foreground" : "border border-border/80 bg-[linear-gradient(145deg,hsl(var(--message-surface)),hsl(var(--secondary)))] text-foreground"}`}><p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{linkifyText(message.body, message.id)}</p></div>
                {groupEnd && <p className={`mt-1 text-[10px] font-medium text-muted-foreground/70 ${mine ? "text-right" : "text-left"}`}>{formatTime(message.created_at)}</p>}
              </div>
            </div>
          </Fragment>;
        })}
        <div ref={endRef} />
      </div>
      <div className="shrink-0 border-t border-border/80 bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="flex items-end gap-1.5 rounded-xl border border-border bg-secondary/45 px-2 py-1.5 shadow-inner">
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); handleSend(); } }} rows={1} maxLength={2000} placeholder={`${floorNumber}Fにメッセージ...`} onFocus={() => scrollToBottom(false)} className="min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0" />
          <Button size="icon" className="h-9 w-9 shrink-0 rounded-full shadow-sm active:scale-90" disabled={pending || !body.trim()} onClick={handleSend}><Send className="h-4 w-4" /></Button>
        </div>
        {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
