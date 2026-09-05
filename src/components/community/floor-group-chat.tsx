"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import {
  getFloorMessagesByIds,
  getOlderFloorMessages,
  markFloorMessagesRead,
  sendFloorMessage,
  type FloorMember,
} from "@/actions/floor-messages";
import { Button } from "@/components/ui/button";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Textarea } from "@/components/ui/textarea";
import { useInitialChatPosition } from "@/components/community/use-initial-chat-position";
import { ChatConnectionStatus } from "./chat-connection-status";
import { useChatRecovery } from "@/components/community/use-chat-recovery";
import { initialMessageCursor, mergeMessages, messageCursorFilter } from "@/lib/message-cursor";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import type { FloorMessageRow } from "@/types/database";
import { useDict } from "@/lib/i18n/locale-provider";
import { ChatMessage, ChatProvider } from "@/components/ui/chat/chat";
import type { ChatMessageData } from "@/components/ui/chat/types";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
function isSameGroup(a: FloorMessageRow | undefined, b: FloorMessageRow | undefined) {
  return !!a && !!b && a.sender_id === b.sender_id
    && Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_WINDOW_MS;
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
  const [liveMessages, setLiveMessages] = useState(messages);
  const [optimisticMessages, setOptimisticMessages] = useState<FloorMessageRow[]>([]);
  const [hasMore, setHasMore] = useState(hasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // A confirmed fetch cursor also recovers gaps before newly delivered realtime messages.
  const recoveryCursorRef = useRef(initialMessageCursor(messages));
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
            setLiveMessages((current) => mergeMessages(current, [fetched]));
            setOptimisticMessages((current) => current.filter((message) => message.id !== id));
            requestAnimationFrame(() => scrollToBottom());
          })();
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [floorNumber]);

  useEffect(() => { void markFloorMessagesRead(); }, [liveMessages.length]);

  const syncMissingMessages = useCallback(async () => {
    const supabase = createClient();
    const { data, error: recoveryError } = await supabase
      .from("floor_messages")
      .select("id,created_at")
      .eq("floor_number", floorNumber)
      .or(messageCursorFilter(recoveryCursorRef.current, "after"))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(50);
    if (recoveryError) throw recoveryError;
    const ids = (data ?? []).map((row) => row.id);
    if (ids.length === 0) return false;
    const result = await getFloorMessagesByIds(ids);
    if (result.messages.length !== ids.length) throw new Error("Message recovery incomplete");
    setLiveMessages((current) => mergeMessages(current, result.messages));
    const latest = data?.at(-1);
    if (latest) recoveryCursorRef.current = { created_at: latest.created_at, id: latest.id };
    return ids.length === 50;
  }, [floorNumber]);

  const connection = useChatRecovery(`floor-${currentUserId}-${floorNumber}`, syncMissingMessages);

  async function loadOlder() {
    if (!hasMore || loadingOlder || liveMessages.length === 0) return;
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    setError(null);
    setLoadingOlder(true);
    try {
      const result = await getOlderFloorMessages({ created_at: liveMessages[0].created_at, id: liveMessages[0].id });
      if (result.error) throw new Error(result.error);
      setLiveMessages((current) => mergeMessages(current, result.messages));
      setHasMore(result.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - previousHeight;
      });
    } catch {
      setError(dict.toast.error);
    } finally {
      setLoadingOlder(false);
    }
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

  return (
    <ChatProvider currentUser={chatCurrentUser} theme="aurora" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--chat-bg-main)] font-[var(--chat-font-sans)] sm:rounded-b-2xl sm:border-x sm:border-b sm:border-[var(--chat-border)] sm:shadow-sm">
      <ChatConnectionStatus state={connection} />
      <PendingFeedback active={pending || loadingOlder} label={loadingOlder ? dict.talks.loadingOlder : dict.talks.sendingMessage} />
      <div ref={setScrollRef} className="chat-messages flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto bg-[linear-gradient(180deg,var(--chat-bg-sidebar),var(--chat-bg-main)_10rem)] px-3.5 py-5 sm:min-h-[20rem] sm:px-5">
        {hasMore && <button type="button" onClick={loadOlder} disabled={loadingOlder} className="mb-3 inline-flex items-center gap-1.5 self-center rounded-full border border-[var(--chat-border)] bg-[var(--chat-bg-main)] px-3 py-1.5 text-[11px] font-semibold text-[var(--chat-text-secondary)] shadow-[var(--chat-shadow-sm)] disabled:opacity-60">{loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}{dict.talks.loadOlder}</button>}
        {displayedMessages.length === 0 && <div className="self-center rounded-full border border-[var(--chat-border)] bg-[var(--chat-bg-header)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--chat-text-secondary)] shadow-[var(--chat-shadow-sm)] backdrop-blur">{dict.talks.floorEmpty.replace("{floor}", String(floorNumber))}</div>}
        {displayedMessages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const member = membersById.get(message.sender_id);
          const previous = displayedMessages[index - 1];
          const next = displayedMessages[index + 1];
          const groupStart = !isSameGroup(previous, message);
          const groupEnd = !isSameGroup(message, next);
          const position: "solo" | "first" | "middle" | "last" = groupStart
            ? (groupEnd ? "solo" : "first")
            : (groupEnd ? "last" : "middle");
          const senderName = member?.full_name ?? dict.talks.residentFallback;
          const chatMessage: ChatMessageData = {
            id: message.id,
            senderId: message.sender_id,
            senderName: member?.room_number ? `${senderName} · ${member.room_number}` : senderName,
            senderAvatar: mine ? undefined : member?.avatar_url || DEFAULT_AVATAR_IMAGE_URL,
            senderRole: mine ? undefined : member?.role ?? "resident",
            text: message.body,
            timestamp: new Date(message.created_at),
            status: message.id.startsWith("pending-") ? "sending" : "sent",
          };
          return <Fragment key={message.id}>
            {message.id === firstUnreadId && <div ref={unreadMarkerRef} className="my-3 flex w-full items-center gap-2" role="separator" aria-label={dict.talks.unreadFromHere}><span className="h-px flex-1 bg-destructive/35" /><span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">{dict.talks.unreadFromHere}</span><span className="h-px flex-1 bg-destructive/35" /></div>}
            <ChatMessage
              message={chatMessage}
              isOutgoing={mine}
              position={position}
              showSender={!mine && groupStart}
              showAvatar={!mine && groupEnd}
              disableActions
            />
          </Fragment>;
        })}
        <div ref={endRef} />
      </div>
      <div className="chat-composer shrink-0 border-t border-[var(--chat-border)] bg-[var(--chat-bg-composer)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.04)] backdrop-blur-xl">
        <div className="flex items-end gap-1.5 rounded-2xl border border-[var(--chat-border-strong)] bg-[var(--chat-bg-sidebar)] px-2 py-1.5 shadow-[var(--chat-shadow-sm)]">
          <Textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); handleSend(); } }} rows={1} maxLength={2000} placeholder={dict.talks.floorPlaceholder.replace("{floor}", String(floorNumber))} onFocus={() => scrollToBottom(false)} className="min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0" />
          <Button size="icon" className="h-9 w-9 shrink-0 rounded-full shadow-sm active:scale-90" disabled={pending || !body.trim()} onClick={handleSend}><Send className="h-4 w-4" /></Button>
        </div>
        {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
      </div>
    </ChatProvider>
  );
}
