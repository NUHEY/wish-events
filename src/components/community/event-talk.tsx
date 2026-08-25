"use client";

import { useEffect, useState, useTransition } from "react";
import { ImagePlus, Send, Smile } from "lucide-react";
import { useRouter } from "next/navigation";
import { markEventTalkRead, sendEventMessage, sendEventSurveyTool } from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; sender_id: string; body: string; created_at: string; mediaUrl?: string | null; message_type: string; action_url: string | null; action_label: string | null; sender: { full_name: string | null; avatar_url: string | null; role: string } | null };

export function EventTalk({ eventId, currentUserId, messages, isRa }: { eventId: string; currentUserId: string; messages: Message[]; isRa: boolean }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`event-talk-${eventId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` }, () => router.refresh()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, router]);
  useEffect(() => { markEventTalkRead(eventId); }, [eventId, messages.length]);
  function submit(mediaPath?: string) {
    startTransition(async () => {
      const result = await sendEventMessage(eventId, body, mediaPath);
      if (result?.error) setError(result.error);
      else { setBody(""); setError(null); router.refresh(); }
    });
  }
  async function uploadImage(file: File) {
    setUploading(true); setError(null);
    const ext = file.name.split(".").pop() || "jpg"; const path = `${eventId}/${crypto.randomUUID()}.${ext}`;
    const supabase = createClient(); const { error: uploadError } = await supabase.storage.from("event-chat-media").upload(path, file, { upsert: false });
    setUploading(false); if (uploadError) setError(`画像の送信に失敗しました: ${uploadError.message}`); else submit(path);
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#fafafa] sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:shadow-sm">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[radial-gradient(circle_at_top,#f4edf0,transparent_44%)] p-3.5 sm:max-h-[56vh] sm:min-h-[20rem] sm:p-4">
        <div className="self-center rounded-full bg-card/90 px-3 py-1 text-[11px] font-medium text-primary shadow-sm">参加ありがとうございます。イベントに関するお知らせはここに届きます。</div>
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return <div key={message.id} className={`flex max-w-[88%] gap-2 ${mine ? "self-end" : "self-start"}`}>
            {!mine && (message.sender?.avatar_url ? <span className="relative mt-1"><img src={message.sender.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />{message.sender.role === "ra" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />}</span> : <span className="relative mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">{message.sender?.full_name?.charAt(0) ?? "?"}{message.sender?.role === "ra" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />}</span>)}
            <div className={`${mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground"} rounded-2xl px-3 py-2 shadow-sm`}>
              {!mine && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">{message.sender?.full_name ?? "RA"}{message.sender?.role === "ra" && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">RA</span>}</p>}
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              {message.mediaUrl && <img src={message.mediaUrl} alt="トークに送信された画像" className="mt-2 max-h-72 rounded-xl object-cover" />}
              {message.message_type === "tool" && message.action_url && <a href={message.action_url} target={message.action_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="mt-2 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{message.action_label ?? "開く"}</a>}
              <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>;
        })}
      </div>
      <div className="border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isRa && <button type="button" onClick={() => startTransition(() => sendEventSurveyTool(eventId).then((result) => { if (result?.error) setError(result.error); else router.refresh(); }))} className="mb-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">アンケート案内を送る</button>}
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-secondary/45 px-2 py-1.5"><label className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-background"><ImagePlus className="h-5 w-5" /><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = ""; }} /></label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} maxLength={2000} placeholder="メッセージ..." className="min-h-10 border-0 bg-transparent py-2 shadow-none focus-visible:ring-0" /><Smile className="mb-2 h-5 w-5 shrink-0 text-muted-foreground" /><Button size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={pending || !body.trim()} onClick={() => submit()}><Send className="h-4 w-4" /></Button></div><p className="mt-1 text-xs text-destructive">{error}</p>
      </div>
    </div>
  );
}
