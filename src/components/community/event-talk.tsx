"use client";

import { useEffect, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { sendEventMessage } from "@/actions/event-community";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; sender_id: string; body: string; created_at: string; sender: { full_name: string | null; avatar_url: string | null; role: string } | null };

export function EventTalk({ eventId, currentUserId, messages }: { eventId: string; currentUserId: string; messages: Message[] }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`event-talk-${eventId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "event_messages", filter: `event_id=eq.${eventId}` }, () => router.refresh()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, router]);
  function submit() {
    startTransition(async () => {
      const result = await sendEventMessage(eventId, body);
      if (result?.error) setError(result.error);
      else { setBody(""); setError(null); router.refresh(); }
    });
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
              <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{new Date(message.created_at).toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>;
        })}
      </div>
      <div className="border-t border-border p-3">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} placeholder="メッセージを入力" className="resize-none" />
        <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-destructive">{error}</p><Button size="sm" disabled={pending || !body.trim()} onClick={submit}><Send className="h-4 w-4" />送信</Button></div>
      </div>
    </div>
  );
}
