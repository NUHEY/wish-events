import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BackButton } from "@/components/layout/back-button";
import { TeamAvatars } from "@/components/team/team-avatars";

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; await getCurrentProfile(); const supabase = await createClient();
  const { data: announcement } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
  if (!announcement) notFound();
  const memberIds = announcement.all_ra_members ? [] : announcement.member_ids ?? [];
  const profileIds = [...new Set([...memberIds, announcement.created_by])];
  const { data: profiles } = profileIds.length ? await (supabase as any).rpc("event_community_profiles_v2", { profile_ids: profileIds }) : { data: [] };
  const members = (profiles ?? []).filter((member: any) => memberIds.includes(member.id));
  const author = (profiles ?? []).find((member: any) => member.id === announcement.created_by);
  return <article className="mx-auto flex max-w-2xl flex-col gap-5"><BackButton fallbackHref="/" className="-ml-2" />{announcement.cover_image_url && <img src={announcement.cover_image_url} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />}<header className="border-b border-border pb-5"><p className="text-xs text-muted-foreground">{new Date(announcement.created_at).toLocaleString("ja-JP")}</p><h1 className="mt-2 text-2xl font-bold">{announcement.title}</h1><div className="mt-3 flex items-center gap-2">{author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">{author?.full_name?.charAt(0) ?? "?"}</span>}<span className="text-sm font-medium">{author?.full_name ?? "RA"}</span><TeamAvatars members={members ?? []} allRa={announcement.all_ra_members} /></div></header><div className="prose prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement.body}</ReactMarkdown></div></article>;
}
