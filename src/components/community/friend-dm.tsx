"use client";

import { shouldReduceMotion } from "@/lib/motion";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useAutoAnimate } from "@/components/layout/use-motion-auto-animate";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import {
  getDirectMessagesByIds,
  getOlderDirectMessages,
  markDirectMessageRead,
  sendDirectMessage,
} from "@/actions/direct-messages";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { createClient } from "@/lib/supabase/client";
import { dmPairFolder } from "@/lib/utils";
import { compressImageFile } from "@/lib/image-compress";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { useInitialChatPosition } from "@/components/community/use-initial-chat-position";
import { ChatConnectionStatus } from "./chat-connection-status";
import { useChatRecovery } from "@/components/community/use-chat-recovery";
import { initialMessageCursor, mergeMessages, messageCursorFilter } from "@/lib/message-cursor";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { ChatMessage, ChatProvider } from "@/components/ui/chat/chat";
import type { ChatMessageData } from "@/components/ui/chat/types";

type DirectMessage = {
  id: string;
  sender_id: string;
  body: string;
  message_type: "text" | "image";
  created_at: string;
  mediaUrl?: string | null;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;
function normalizeBody(text: string) {
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function isSameGroup(a: DirectMessage | undefined, b: DirectMessage | undefined) {
  if (!a || !b) return false;
  if (a.sender_id !== b.sender_id) return false;
  return Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < GROUP_WINDOW_MS;
}

/**
 * 友達間の1:1ダイレクトメッセージ画面。event-talk.tsxと同じ見た目・実装方針
 * （吹き出しグルーピング、画像はまとめ送信、リアルタイムは新着分だけ差分取得）だが、
 * RAツール・投票・リアクションはDMには不要なため持たない、より軽量な構成にしている。
 */
export function FriendDm({
  friendId,
  currentUserId,
  friendName,
  friendAvatarUrl,
  friendRole,
  messages,
  hasMoreOlder = false,
  initialLastReadAt = null,
}: {
  friendId: string;
  currentUserId: string;
  friendName: string;
  friendAvatarUrl: string | null;
  friendRole: string;
  messages: DirectMessage[];
  hasMoreOlder?: boolean;
  initialLastReadAt?: string | null;
}) {
  const dict = useDict();
  const locale = useLocale();
  const [liveMessages, setLiveMessages] = useState<DirectMessage[]>(messages);
  const [optimisticMessages, setOptimisticMessages] = useState<DirectMessage[]>([]);
  const [hasMoreOlderState, setHasMoreOlderState] = useState(hasMoreOlder);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [stagedImages, setStagedImages] = useState<Array<{ id: string; file: File; previewUrl: string }>>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // A confirmed fetch cursor also recovers gaps before newly delivered realtime messages.
  const recoveryCursorRef = useRef(initialMessageCursor(messages));
  const [messagesAnimateRef] = useAutoAnimate<HTMLDivElement>({ duration: 130, easing: "ease-out" });
  // scrollRefとmessagesAnimateRefを合成するref関数はuseCallbackで固定化する。
  // インラインの矢印関数のままだと描画のたびに新しい関数として扱われ、Reactが
  // 毎回ref付け外しを行う。useAutoAnimateが返すref本体は呼ばれるたびに内部で
  // setStateするため、再描画→ref再アタッチ→setState→再描画...という無限ループ
  // （「表示中に問題が発生しました」の原因だったMaximum update depth exceeded）
  // を引き起こしていた。
  const setMessagesScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      messagesAnimateRef(node);
    },
    [messagesAnimateRef]
  );

  const displayedMessages = useMemo(
    () => [...liveMessages, ...optimisticMessages.filter((m) => !liveMessages.some((saved) => saved.id === m.id))],
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

  function scrollToBottom(smooth = true) {
    endRef.current?.scrollIntoView({ behavior: smooth && !shouldReduceMotion() ? "smooth" : "instant", block: "end" });
  }

  // 相手からの新着メッセージだけをリアルタイムで差分取得する。
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dm-${dmPairFolder(currentUserId, friendId)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages", filter: `sender_id=eq.${friendId}` },
        (payload) => {
          const row = payload.new as { id: string; recipient_id: string };
          if (row.recipient_id !== currentUserId) return;
          void (async () => {
            const { messages: fetched } = await getDirectMessagesByIds(friendId, [row.id]);
            if (fetched.length === 0) return;
            setLiveMessages((current) => mergeMessages(current, fetched as DirectMessage[]));
            scrollToBottom();
          })();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [friendId, currentUserId]);

  useEffect(() => {
    markDirectMessageRead(friendId);
  }, [friendId, liveMessages.length]);

  const syncMissingMessages = useCallback(async () => {
    const supabase = createClient();
    const { data, error: recoveryError } = await supabase
      .from("direct_messages")
      .select("id,created_at")
      .or(`and(sender_id.eq.${friendId},recipient_id.eq.${currentUserId}),and(sender_id.eq.${currentUserId},recipient_id.eq.${friendId})`)
      .or(messageCursorFilter(recoveryCursorRef.current, "after"))
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(50);
    if (recoveryError) throw recoveryError;
    const ids = (data ?? []).map((row) => row.id);
    if (ids.length === 0) return false;
    const result = await getDirectMessagesByIds(friendId, ids);
    if (result.messages.length !== ids.length) throw new Error("Message recovery incomplete");
    setLiveMessages((current) => mergeMessages(current, result.messages as DirectMessage[]));
    const latest = data?.at(-1);
    if (latest) recoveryCursorRef.current = { created_at: latest.created_at, id: latest.id };
    return ids.length === 50;
  }, [currentUserId, friendId]);

  const connection = useChatRecovery(`friend-${currentUserId}-${friendId}`, syncMissingMessages);

  async function loadOlder() {
    if (!hasMoreOlderState || loadingOlder || liveMessages.length === 0) return;
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    setError(null);
    setLoadingOlder(true);
    try {
      const oldest = { created_at: liveMessages[0].created_at, id: liveMessages[0].id };
      const res = await getOlderDirectMessages(friendId, oldest, 40);
      setLiveMessages((current) => mergeMessages(current, res.messages as DirectMessage[]));
      setHasMoreOlderState(res.hasMore);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - prevHeight;
      });
    } catch {
      setError(dict.toast.error);
    } finally {
      setLoadingOlder(false);
    }
  }

  function addStagedFiles(files: File[]) {
    setError(null);
    const room = Math.max(0, 6 - stagedImages.length);
    const oversized = files.some((f) => f.size > 8 * 1024 * 1024);
    if (oversized) setError(dict.talks.imageTooLarge);
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

    if (stagedImages.length === 0) {
      setBody("");
      const tempId = `pending-${crypto.randomUUID()}`;
      setOptimisticMessages((current) => [
        ...current,
        { id: tempId, sender_id: currentUserId, body: text, created_at: new Date().toISOString(), message_type: "text", mediaUrl: null },
      ]);
      requestAnimationFrame(() => scrollToBottom());
      startTransition(async () => {
        const result = await sendDirectMessage(friendId, text, []);
        if (result?.error) {
          setOptimisticMessages((current) => current.filter((m) => m.id !== tempId));
          setBody(text);
          setError(result.error);
        } else {
          const real = (result.messages ?? [])[0];
          if (real) {
            setOptimisticMessages((current) =>
              current.map((m) => (m.id === tempId ? { ...real, mediaUrl: null } : m))
            );
          }
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
      const folder = dmPairFolder(currentUserId, friendId);
      const uploadedPaths: (string | null)[] = [];
      for (const item of staged) {
        const ext = item.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${folder}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("dm-media")
          .upload(path, item.file, { contentType: item.file.type, upsert: false });
        uploadedPaths.push(uploadError ? null : path);
      }
      setUploading(false);
      const okIndexes = uploadedPaths
        .map((path, index) => ({ path, index }))
        .filter((entry): entry is { path: string; index: number } => !!entry.path);
      if (okIndexes.length === 0) {
        setError(dict.talks.imageSendFailed);
        return;
      }
      const okPaths = okIndexes.map((entry) => entry.path);
      const okStaged = okIndexes.map((entry) => staged[entry.index]);
      const tempIds = okStaged.map(() => `pending-${crypto.randomUUID()}`);
      setOptimisticMessages((current) => [
        ...current,
        ...okStaged.map((item, i) => ({
          id: tempIds[i],
          sender_id: currentUserId,
          body: i === 0 ? text : "",
          created_at: new Date(Date.now() + i).toISOString(),
          message_type: "image" as const,
          mediaUrl: item.previewUrl,
        })),
      ]);
      requestAnimationFrame(() => scrollToBottom());
      startTransition(async () => {
        const result = await sendDirectMessage(friendId, text, okPaths);
        if (result?.error) {
          setOptimisticMessages((current) => current.filter((m) => !tempIds.includes(m.id)));
          setError(result.error);
        } else {
          const real = result.messages ?? [];
          setOptimisticMessages((current) =>
            current.map((m) => {
              const idx = tempIds.indexOf(m.id);
              return idx >= 0 && real[idx] ? { ...real[idx], mediaUrl: okStaged[idx]?.previewUrl ?? null } : m;
            })
          );
        }
      });
    })();
  }

  return (
    <ChatProvider currentUser={chatCurrentUser} theme="aurora" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--chat-bg-main)] font-[var(--chat-font-sans)] sm:rounded-b-2xl sm:border-x sm:border-b sm:border-[var(--chat-border)] sm:shadow-sm">
      <ChatConnectionStatus state={connection} />
      <PendingFeedback active={pending || uploading || loadingOlder} label={loadingOlder ? dict.talks.loadingOlder : uploading ? dict.talks.sendingImage : dict.talks.sendingMessage} />
      <div
        ref={setMessagesScrollRef}
        className="chat-messages flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto bg-[linear-gradient(180deg,var(--chat-bg-sidebar),var(--chat-bg-main)_10rem)] px-3.5 py-5 sm:min-h-[20rem] sm:px-5"
      >
        {hasMoreOlderState && (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="mb-3 inline-flex items-center gap-1.5 self-center rounded-full border border-[var(--chat-border)] bg-[var(--chat-bg-main)] px-3 py-1.5 text-[11px] font-semibold text-[var(--chat-text-secondary)] shadow-[var(--chat-shadow-sm)] disabled:opacity-60"
          >
            {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}
            {dict.talks.loadOlder}
          </button>
        )}
        {displayedMessages.length === 0 && (
          <div className="mb-3 self-center rounded-full border border-[var(--chat-border)] bg-[var(--chat-bg-header)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--chat-text-secondary)] shadow-[var(--chat-shadow-sm)] backdrop-blur">
            {dict.talks.directEmpty.replace("{name}", friendName)}
          </div>
        )}
        {displayedMessages.map((message, index) => {
          const mine = message.sender_id === currentUserId;
          const prev = displayedMessages[index - 1];
          const next = displayedMessages[index + 1];
          const isGroupStart = !isSameGroup(prev, message);
          const isGroupEnd = !isSameGroup(message, next);
          const position = isGroupStart ? (isGroupEnd ? "solo" : "first") : (isGroupEnd ? "last" : "middle");
          const chatMessage: ChatMessageData = {
            id: message.id,
            senderId: message.sender_id,
            senderName: mine ? "You" : friendName,
            senderAvatar: mine ? undefined : friendAvatarUrl || DEFAULT_AVATAR_IMAGE_URL,
            senderRole: mine ? undefined : friendRole,
            text: normalizeBody(message.body) || undefined,
            images: message.mediaUrl ? [{ url: message.mediaUrl, width: 1200, height: 900, alt: dict.talks.directImageAlt }] : undefined,
            timestamp: new Date(message.created_at),
            status: message.id.startsWith("pending-") ? "sending" : "sent",
          };

          return (
            <Fragment key={message.id}>
              {message.id === firstUnreadId && (
                <div ref={unreadMarkerRef} className="my-3 flex w-full items-center gap-2" role="separator" aria-label={dict.talks.unreadFromHere}>
                  <span className="h-px flex-1 bg-destructive/35" />
                  <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">{dict.talks.unreadFromHere}</span>
                  <span className="h-px flex-1 bg-destructive/35" />
                </div>
              )}
              <ChatMessage
                message={chatMessage}
                isOutgoing={mine}
                position={position}
                showAvatar={!mine && isGroupEnd}
                disableActions
              />
            </Fragment>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-composer max-h-[58%] shrink-0 overflow-y-auto overscroll-contain border-t border-[var(--chat-border)] bg-[var(--chat-bg-composer)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.04)] backdrop-blur-xl sm:max-h-none sm:overflow-visible">
        {stagedImages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {stagedImages.map((item) => (
              <div key={item.id} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeStagedImage(item.id)}
                  aria-label={dict.talks.remove}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5 rounded-2xl border border-[var(--chat-border-strong)] bg-[var(--chat-bg-sidebar)] px-2 py-1.5 shadow-[var(--chat-shadow-sm)]">
          <label className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background">
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
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={uploading ? dict.talks.uploadingImage : dict.talks.composerPlaceholder}
            onFocus={() => {
              scrollToBottom(false);
              window.visualViewport?.addEventListener(
                "resize",
                () => window.requestAnimationFrame(() => scrollToBottom(false)),
                { once: true }
              );
            }}
            className="min-w-0 min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0"
          />
          <Button
            size="icon"
            aria-label={locale === "ja" ? "メッセージを送信" : "Send message"}
            className="h-11 w-11 shrink-0 rounded-full shadow-sm transition-transform active:scale-90"
            disabled={pending || uploading || (!body.trim() && stagedImages.length === 0)}
            onClick={handleSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
      </div>
    </ChatProvider>
  );
}
