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
import { useChatRecovery } from "@/components/community/use-chat-recovery";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import type { FloorMessageRow } from "@/types/database";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { ChatProvider } from "@/components/ui/chat/chat";

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
  const dict = useDict();
  const locale = useLocale();
  const [liveMessages, setLiveMessages] = useState(messages);
  const [optimisticMessages, setOptimisticMessages] = useState<FloorMessageRow[]>([]);
  const [hasMore, setHasMore] = useState(hasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const latestMessageAtRef = useRef(messages.at(-1)?.created_at ?? "1970-01-01T00:00:00.000Z");
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const displayedMessages = useMemo(
    () => [...liveMessages, ...optimisticMessages.filter((item) => !liveMessages.some((saved) => saved.id === item.id))],
    [liveMessages, optimisticMessages]
  );
  const chatCurrentUser = useMemo(() => ({ id: currentUserId, name: "You" }), [currentUserId]);
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

  useEffect(() => {
    const latest = displayedMessages.reduce(
      (current, message) => message.created_at > current ? message.created_at : current,
      latestMessageAtRef.current
    );
    latestMessageAtRef.current = latest;
  }, [displayedMessages]);

  const syncMissingMessages = useCallback(async () => {
    const supabase = createClient();
    const { data, error: recoveryError } = await supabase
      .from("floor_messages")
      .select("id,created_at")
      .eq("floor_number", floorNumber)
      .gt("created_at", latestMessageAtRef.current)
      .order("created_at", { ascending: true })
      .limit(50);
    if (recoveryError) throw recoveryError;
    const ids = (data ?? []).map((row) => row.id);
    if (ids.length === 0) return;
    const result = await getFloorMessagesByIds(ids);
    setLiveMessages((current) => [
      ...current,
      ...result.messages.filter((message) => !current.some((saved) => saved.id === message.id)),
    ]);
    const latest = data?.at(-1)?.created_at;
    if (latest) latestMessageAtRef.current = latest;
  }, [floorNumber]);

  useChatRecovery(`floor-${floorNumber}`, syncMissingMessages);

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
        setError(result.error ?? dict.talks.sendFailed);
        return;
      }
      setOptimisticMessages((current) => current.filter((message) => message.id !== temporaryId));
      setLiveMessages((current) => current.some((message) => message.id === result.message!.id)
        ? current
        : [...current, result.message!]);
    });
  }

  const formatTime = (value: string) => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

  return (
    <ChatProvider currentUser={chatCurrentUser} theme="aurora" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--chat-bg-main)] font-[var(--chat-font-sans)] sm:rounded-b-2xl sm:border-x sm:border-b sm:border-[var(--chat-border)] sm:shadow-sm">
      <PendingFeedback active={pending || loadingOlder} label={loadingOlder ? dict.talks.loadingOlder : dict.talks.sendingMessage} />
      <div ref={setScrollRef} className="chat-messages flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto bg-[radial-gradient(ellipse_at_top,var(--chat-bg-sidebar)_0%,var(--chat-bg-main)_72%)] px-3.5 py-5 sm:min-h-[20rem] sm:px-4">
        {hasMore && <button type="button" onClick={loadOlder} disabled={loadingOlder} className="mb-2 inline-flex items-center gap-1.5 self-center rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm disabled:opacity-60">{loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}{dict.talks.loadOlder}</button>}
        {displayedMessages.length === 0 && <div className="self-center rounded-full border border-border/70 bg-card/85 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">{dict.talks.floorEmpty.replace("{floor}", String(floorNumber))}</div>}
        {displayedMessages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const member = membersById.get(message.sender_id);
          const previous = displayedMessages[index - 1];
          const next = displayedMessages[index + 1];
          const groupStart = !isSameGroup(previous, message);
          const groupEnd = !isSameGroup(message, next);
          return <Fragment key={message.id}>
            {message.id === firstUnreadId && <div ref={unreadMarkerRef} className="my-3 flex w-full items-center gap-2" role="separator" aria-label={dict.talks.unreadFromHere}><span className="h-px flex-1 bg-destructive/35" /><span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">{dict.talks.unreadFromHere}</span><span className="h-px flex-1 bg-destructive/35" /></div>}
            <div className={`flex max-w-[88%] gap-2 ${mine ? "self-end" : "self-start"} ${groupStart && index !== 0 ? "mt-3" : ""}`}>
              {!mine && (groupEnd ? <span className="mt-1 self-end shrink-0"><AvatarRing role={member?.role ?? "resident"} size={28}><Image src={member?.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" /></AvatarRing></span> : <span className="w-7 shrink-0" />)}
              <div className="min-w-0">
                {!mine && groupStart && <p className="mb-1 px-1 text-[10px] font-semibold text-muted-foreground">{member?.full_name ?? dict.talks.residentFallback}{member?.room_number ? ` · ${member.room_number}` : ""}</p>}
                <div className={`chat-bubble rounded-xl px-3.5 py-2.5 shadow-[var(--chat-shadow-sm)] ${groupEnd ? mine ? "rounded-br-md" : "rounded-bl-md" : ""} ${mine ? "bg-[var(--chat-bubble-outgoing)] text-[var(--chat-bubble-outgoing-text)]" : "border border-[var(--chat-border)] bg-[var(--chat-bubble-incoming)] text-[var(--chat-bubble-incoming-text)]"}`}><p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{linkifyText(message.body, message.id)}</p></div>
                {groupEnd && <p className={`mt-1 text-[10px] font-medium text-muted-foreground/70 ${mine ? "text-right" : "text-left"}`}>{formatTime(message.created_at)}</p>}
              </div>
            </div>
          </Fragment>;
        })}
        <div ref={endRef} />
      </div>
      <div className="chat-composer shrink-0 border-t border-[var(--chat-border)] bg-[var(--chat-bg-composer)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="flex items-end gap-1.5 rounded-xl border border-[var(--chat-border-strong)] bg-[var(--chat-bg-sidebar)] px-2 py-1.5 shadow-inner">
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); handleSend(); } }} rows={1} maxLength={2000} placeholder={dict.talks.floorPlaceholder.replace("{floor}", String(floorNumber))} onFocus={() => scrollToBottom(false)} className="min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0" />
          <Button size="icon" className="h-9 w-9 shrink-0 rounded-full shadow-sm active:scale-90" disabled={pending || !body.trim()} onClick={handleSend}><Send className="h-4 w-4" /></Button>
        </div>
        {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
      </div>
    </ChatProvider>
  );
}
