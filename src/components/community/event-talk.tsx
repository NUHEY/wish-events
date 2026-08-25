"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BarChart3, ChevronDown, ImagePlus, Info, Send, Smile, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createEventPoll, markEventTalkRead, sendEventDetailsTool, sendEventMessage, sendEventSurveyTool, toggleEventMessageReaction, voteEventPoll } from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string; sender_id: string; body: string; created_at: string; mediaUrl?: string | null;
  message_type: "text" | "image" | "tool" | "poll"; action_url: string | null; action_label: string | null; poll_id?: string | null;
  sender: { full_name: string | null; avatar_url: string | null; role: string } | null;
};
type Reaction = { message_id: string; user_id: string; emoji: "❤️" | "👍" | "🎉" | "😂" | "👀" };
type Poll = { id: string; question: string; options: string[]; closes_at?: string | null };
type Vote = { poll_id: string; user_id: string; option_index: number };
const EMOJIS: Reaction["emoji"][] = ["❤️", "👍", "🎉", "😂", "👀"];

export function EventTalk({ eventId, currentUserId, messages, reactions, polls, votes, isRa }: { eventId: string; currentUserId: string; messages: Message[]; reactions: Reaction[]; polls: Poll[]; votes: Vote[]; isRa: boolean }) {
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
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const displayedMessages = useMemo(() => [...messages, ...optimisticMessages.filter((message) => !messages.some((saved) => saved.id === message.id))], [messages, optimisticMessages]);
  const pollsById = useMemo(() => new Map(polls.map((poll) => [poll.id, poll])), [polls]);

  useEffect(() => setReactionState(reactions), [reactions]);
  useEffect(() => setVoteState(votes), [votes]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`event-talk-${eventId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` }, () => router.refresh()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, router]);
  useEffect(() => { markEventTalkRead(eventId); }, [eventId, messages.length]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [displayedMessages.length]);

  function addOptimisticMessage(message: Message) {
    setOptimisticMessages((current) => [...current, message]);
    setTimeout(() => setOptimisticMessages((current) => current.filter((item) => item.id !== message.id)), 9000);
  }
  function submit(mediaPath?: string, localMediaUrl?: string) {
    const text = body.trim();
    if (!text && !mediaPath) return;
    setBody(""); setError(null);
    const tempId = `pending-${crypto.randomUUID()}`;
    addOptimisticMessage({ id: tempId, sender_id: currentUserId, body: text, created_at: new Date().toISOString(), mediaUrl: localMediaUrl ?? null, message_type: mediaPath ? "image" : "text", action_url: null, action_label: null, sender: null });
    startTransition(async () => {
      const result = await sendEventMessage(eventId, text, mediaPath);
      if (result?.error) {
        setOptimisticMessages((current) => current.filter((message) => message.id !== tempId));
        setBody(text); setError(result.error);
      } else {
        setOptimisticMessages((current) => current.map((message) => message.id === tempId ? { ...message, id: result.message!.id } : message));
        router.refresh();
      }
    });
  }
  async function uploadImage(file: File) {
    if (file.size > 8 * 1024 * 1024) { setError("画像は8MB以下にしてください"); return; }
    setUploading(true); setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const localMediaUrl = URL.createObjectURL(file);
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage.from("event-chat-media").upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (uploadError) { URL.revokeObjectURL(localMediaUrl); setError(`画像の送信に失敗しました: ${uploadError.message}`); return; }
    submit(path, localMediaUrl);
  }
  function react(messageId: string, emoji: Reaction["emoji"]) {
    const active = reactionState.some((reaction) => reaction.message_id === messageId && reaction.user_id === currentUserId && reaction.emoji === emoji);
    setReactionState((current) => active ? current.filter((reaction) => !(reaction.message_id === messageId && reaction.user_id === currentUserId && reaction.emoji === emoji)) : [...current, { message_id: messageId, user_id: currentUserId, emoji }]);
    void toggleEventMessageReaction(messageId, emoji, active).then((result) => {
      if (result?.error) { setError(result.error); router.refresh(); }
    });
  }
  function castVote(pollId: string, optionIndex: number) {
    const oldVote = voteState.find((vote) => vote.poll_id === pollId && vote.user_id === currentUserId);
    setVoteState((current) => [...current.filter((vote) => !(vote.poll_id === pollId && vote.user_id === currentUserId)), { poll_id: pollId, user_id: currentUserId, option_index: optionIndex }]);
    void voteEventPoll(pollId, optionIndex).then((result) => { if (result?.error) { setError(result.error); setVoteState((current) => [...current.filter((vote) => !(vote.poll_id === pollId && vote.user_id === currentUserId)), ...(oldVote ? [oldVote] : [])]); } });
  }
  function createPoll() {
    startTransition(async () => {
      const result = await createEventPoll(eventId, pollQuestion, pollOptions);
      if (result?.error) setError(result.error);
      else { setPollQuestion(""); setPollOptions(["", ""]); setPollOpen(false); setToolOpen(false); router.refresh(); }
    });
  }
  const time = (createdAt: string) => new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date(createdAt));

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f8f7f8] sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-sm">
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[radial-gradient(ellipse_at_top,#f5e9ef_0%,#fafafa_42%,#f8f7f8_100%)] px-3.5 py-5 sm:max-h-[56vh] sm:min-h-[20rem] sm:px-4">
      <div className="self-center rounded-full border border-white/70 bg-white/85 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">イベントに関するお知らせと会話</div>
      {displayedMessages.map((message) => {
        const mine = message.sender_id === currentUserId;
        const messageReactions = reactionState.filter((reaction) => reaction.message_id === message.id);
        const reactionGroups = EMOJIS.map((emoji) => ({ emoji, count: messageReactions.filter((reaction) => reaction.emoji === emoji).length, active: messageReactions.some((reaction) => reaction.emoji === emoji && reaction.user_id === currentUserId) })).filter((reaction) => reaction.count > 0);
        const poll = message.poll_id ? pollsById.get(message.poll_id) : undefined;
        return <div key={message.id} className={`group flex max-w-[91%] gap-2 motion-safe:animate-[fade-in_180ms_ease-out] ${mine ? "self-end" : "self-start"}`}>
          {!mine && (message.sender?.avatar_url ? <span className="relative mt-1"><img src={message.sender.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shadow-sm" />{message.sender.role === "ra" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />}</span> : <span className="relative mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs shadow-sm">{message.sender?.full_name?.charAt(0) ?? "?"}{message.sender?.role === "ra" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />}</span>)}
          <div className="min-w-0">
            {!mine && <p className="mb-1 pl-1 text-[11px] font-semibold text-muted-foreground">{message.sender?.full_name ?? "RA"}{message.sender?.role === "ra" && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">RA</span>}</p>}
            <div className={`${mine ? "rounded-[22px] rounded-br-md bg-[linear-gradient(145deg,hsl(var(--primary)),hsl(var(--primary)/0.82))] text-primary-foreground" : "rounded-[22px] rounded-bl-md border border-white/80 bg-[linear-gradient(145deg,#ffffff,#fbf8fa)] text-foreground"} px-3.5 py-2.5 shadow-[0_2px_10px_rgba(44,24,34,0.08)]`}>
              {message.body && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{message.body}</p>}
              {message.mediaUrl && <img src={message.mediaUrl} alt="トークに送信された画像" className="mt-1.5 max-h-80 min-w-48 rounded-2xl object-cover" />}
              {message.message_type === "tool" && message.action_url && <a href={message.action_url} target={message.action_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="mt-2 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95">{message.action_label ?? "開く"}</a>}
              {poll && <PollCard poll={poll} votes={voteState.filter((vote) => vote.poll_id === poll.id)} currentUserId={currentUserId} onVote={castVote} />}
              <p className={`mt-1.5 text-right text-[10px] font-medium ${mine ? "text-primary-foreground/65" : "text-muted-foreground/80"}`}>{time(message.created_at)}</p>
            </div>
            <div className={`relative -mt-1 flex items-center gap-1 ${mine ? "justify-end" : "justify-start"}`}>
              {reactionGroups.map((reaction) => <button key={reaction.emoji} type="button" onClick={() => react(message.id, reaction.emoji)} className={`rounded-full border px-1.5 py-0.5 text-[11px] shadow-sm transition-transform active:scale-90 ${reaction.active ? "border-primary/40 bg-primary/10" : "border-border bg-card"}`}>{reaction.emoji} {reaction.count}</button>)}
              <span className="flex rounded-full border border-border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                {EMOJIS.slice(0, 3).map((emoji) => <button key={emoji} type="button" aria-label={`${emoji}でリアクション`} onClick={() => react(message.id, emoji)} className="rounded-full px-1 text-xs transition-transform hover:scale-125">{emoji}</button>)}
              </span>
            </div>
          </div>
        </div>;
      })}
      <div ref={endRef} />
    </div>
    <div className="border-t border-border/80 bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {isRa && <div className="mb-2"><button type="button" onClick={() => setToolOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"><Sparkles className="h-3.5 w-3.5" />ツール<ChevronDown className={`h-3.5 w-3.5 transition-transform ${toolOpen ? "rotate-180" : ""}`} /></button>{toolOpen && <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background p-2 shadow-lg"><button type="button" onClick={() => startTransition(() => sendEventSurveyTool(eventId).then((result) => { if (result?.error) setError(result.error); else router.refresh(); }))} className="rounded-xl p-2 text-left text-xs font-semibold hover:bg-secondary"><Smile className="mb-1 h-4 w-4 text-primary" />アンケート</button><button type="button" onClick={() => setPollOpen((open) => !open)} className="rounded-xl p-2 text-left text-xs font-semibold hover:bg-secondary"><BarChart3 className="mb-1 h-4 w-4 text-primary" />投票</button><button type="button" onClick={() => startTransition(() => sendEventDetailsTool(eventId).then((result) => { if (result?.error) setError(result.error); else router.refresh(); }))} className="rounded-xl p-2 text-left text-xs font-semibold hover:bg-secondary"><Info className="mb-1 h-4 w-4 text-primary" />詳細案内</button></div>}{pollOpen && <div className="mt-2 rounded-2xl border border-border bg-background p-3 shadow-lg"><input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="投票の質問" maxLength={300} className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />{pollOptions.map((option, index) => <input key={index} value={option} onChange={(e) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} placeholder={`選択肢 ${index + 1}`} maxLength={120} className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary" />)}<div className="mt-2 flex justify-between"><button type="button" disabled={pollOptions.length >= 4} onClick={() => setPollOptions((current) => [...current, ""])} className="text-xs font-semibold text-primary disabled:opacity-40">＋ 選択肢を追加</button><Button size="sm" disabled={pending} onClick={createPoll}>投票を送る</Button></div></div>}</div>}
      <div className="flex items-end gap-1.5 rounded-[22px] border border-border bg-secondary/45 px-2 py-1.5 shadow-inner"><label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = ""; }} /></label><Textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} rows={1} maxLength={2000} placeholder={uploading ? "画像を送信中…" : "メッセージ..."} className="min-h-10 max-h-28 border-0 bg-transparent py-2 text-[16px] shadow-none focus-visible:ring-0" /><Smile className="mb-2 h-5 w-5 shrink-0 text-muted-foreground" /><Button size="icon" className="h-9 w-9 shrink-0 rounded-full shadow-sm transition-transform active:scale-90" disabled={pending || uploading || !body.trim()} onClick={() => submit()}><Send className="h-4 w-4" /></Button></div>
      {error && <p className="mt-1.5 px-1 text-xs text-destructive">{error}</p>}
    </div>
  </div>;
}

function PollCard({ poll, votes, currentUserId, onVote }: { poll: Poll; votes: Vote[]; currentUserId: string; onVote: (pollId: string, optionIndex: number) => void }) {
  const selected = votes.find((vote) => vote.user_id === currentUserId)?.option_index;
  const total = votes.length;
  return <div className="mt-2 min-w-60 rounded-2xl bg-black/5 p-2.5 text-foreground"><div className="mb-2 flex items-center gap-1.5 text-xs font-bold"><BarChart3 className="h-4 w-4 text-primary" />投票</div><p className="mb-2 text-sm font-semibold">{poll.question}</p><div className="space-y-1.5">{poll.options.map((option, index) => { const count = votes.filter((vote) => vote.option_index === index).length; const percentage = total ? Math.round((count / total) * 100) : 0; return <button key={index} type="button" onClick={() => onVote(poll.id, index)} className={`relative flex w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs font-medium transition-transform active:scale-[0.98] ${selected === index ? "border-primary/50" : "border-border/70 bg-card/80"}`}><span className="absolute inset-y-0 left-0 bg-primary/12 transition-[width] duration-300" style={{ width: `${percentage}%` }} /><span className="relative flex-1">{option}</span><span className="relative text-muted-foreground">{selected !== undefined ? `${percentage}%` : "投票"}</span></button>; })}</div>{selected !== undefined && <p className="mt-2 text-[10px] text-muted-foreground">{total}票 · 選択を変更できます</p>}</div>;
}
