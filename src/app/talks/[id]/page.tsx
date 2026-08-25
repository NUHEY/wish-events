import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { EventTalk } from "@/components/community/event-talk";
import { BackButton } from "@/components/layout/back-button";

export default async function EventTalkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ joined?: string }> }) {
  const { id } = await params; const { joined } = await searchParams; const profile = await getCurrentProfile(); const supabase = await createClient();
  const [{ data: event }, { data: registration }, { data: messages }] = await Promise.all([
    supabase.from("events").select("id, title, poster_url").eq("id", id).maybeSingle(),
    supabase.from("registrations").select("id").eq("event_id", id).eq("user_id", profile.id).maybeSingle(),
    supabase.from("event_messages").select("*").eq("event_id", id).order("created_at"),
  ]);
  if (!event) notFound(); if (profile.role !== "ra" && !registration) redirect(`/events/${id}`);
  const senderIds = [...new Set((messages ?? []).map((message) => message.sender_id))];
  const { data: users } = senderIds.length ? await (supabase as any).rpc("event_community_profiles", { profile_ids: senderIds }) : { data: [] };
  const usersById = new Map((users ?? []).map((user: { id: string; full_name: string | null; avatar_url: string | null }) => [user.id, user]));
  const hydrated = (messages ?? []).map((message) => ({ ...message, sender: usersById.get(message.sender_id) ?? null }));
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><BackButton fallbackHref="/talks" className="-ml-2" /><div className="flex items-center gap-3"><>{event.poster_url && <img src={event.poster_url} alt="" className="h-11 w-11 rounded-xl object-cover" />}</><div><h1 className="text-lg font-bold">{event.title}</h1><Link href={`/events/${id}`} className="text-xs text-primary hover:underline">イベント詳細を見る</Link></div></div>{joined === "1" && <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">イベントへの参加ありがとうございます。最新情報はこのトークでお知らせします。</div>}<EventTalk eventId={id} currentUserId={profile.id} messages={hydrated} /></div>;
}
