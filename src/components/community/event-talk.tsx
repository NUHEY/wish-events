"use client";

import { useEffect, useState, useTransition } from "react";
import { ImagePlus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { sendEventMessage, sendEventSurveyTool } from "@/actions/event-community";
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
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex max-h-[56vh] min-h-[20rem] flex-col gap-3 overflow-y-auto bg-secondary/20 p-4">
        <div className="self-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">参加ありがとうございます。イベントに関するお知らせはここに届きます。</div>
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId;
          return <div key={message.id} className={`flex max-w-[85%] gap-2 ${mine ? "self-end" : "self-start"}`}>
            {!mine && (message.sender?.avatar_url ? <img src={message.sender.avatar_url} alt="" className="mt-1 h-7 w-7 rounded-full object-cover" /> : <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">{message.sender?.full_name?.charAt(0) ?? "?"}</span>)}
            <div className={`${mine ? "bg-primary text-primary-foreground" : "bg-background"} rounded-2xl px-3 py-2 shadow-sm`}>
              {!mine && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">{message.sender?.full_name ?? "RA"}{message.sender?.role === "ra" && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-primary-foreground">RA</span>}</p>}
              <p className="whitespace-pre-wrap text-sm">{message.body}</p>
              {message.mediaUrl && <img src={message.mediaUrl} alt="トークに送信された画像" className="mt-2 max-h-72 rounded-xl object-cover" />}
              {message.message_type === "tool" && message.action_url && <a href={message.action_url} target={message.action_url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="mt-2 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">{message.action_label ?? "開く"}</a>}
              <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>;
        })}
      </div>
      <div className="border-t border-border p-3">
        {isRa && <button type="button" onClick={() => startTransition(() => sendEventSurveyTool(eventId).then((result) => { if (result?.error) setError(result.error); else router.refresh(); }))} className="mb-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">アンケート案内を送る</button>}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} placeholder="メッセージを入力" className="resize-none" />
        <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-destructive">{error}</p><div className="flex gap-2"><label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-secondary"><ImagePlus className="h-4 w-4" /><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = ""; }} /></label><Button size="sm" disabled={pending || !body.trim()} onClick={() => submit()}><Send className="h-4 w-4" />送信</Button></div></div>
      </div>
    </div>
  );
}
