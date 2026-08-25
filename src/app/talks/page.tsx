import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { formatEventDateTime } from "@/lib/utils";

export default async function TalksPage() {
  const profile = await getCurrentProfile(); const supabase = await createClient();
  const { data: registrations } = await supabase.from("registrations").select("event_id, events(id, title, title_en, event_date, poster_url)").eq("user_id", profile.id).order("registered_at", { ascending: false });
  const rooms = (registrations ?? []).map((r: any) => r.events).filter(Boolean);
  return <div className="mx-auto flex max-w-2xl flex-col gap-5"><div><h1 className="text-2xl font-bold">トーク</h1><p className="mt-1 text-sm text-muted-foreground">参加したイベントのお知らせと会話を確認できます。</p></div><div className="flex flex-col gap-2">{rooms.map((event: any) => <Link key={event.id} href={`/talks/${event.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40">{event.poster_url ? <img src={event.poster_url} alt="" className="h-14 w-14 rounded-xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-6 w-6" /></span>}<span className="min-w-0 flex-1"><span className="block truncate font-semibold">{event.title}</span><span className="mt-1 block text-xs text-muted-foreground">{formatEventDateTime(event.event_date, "ja")}</span></span><MessageCircle className="h-5 w-5 text-muted-foreground" /></Link>)}{rooms.length === 0 && <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">参加したイベントはまだありません。</div>}</div></div>;
}
