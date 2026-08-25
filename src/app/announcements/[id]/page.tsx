import { notFound } from "next/navigation";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BackButton } from "@/components/layout/back-button";
import { Badge } from "@/components/ui/badge";
import { isImportantTag } from "@/lib/utils";

/** event_community_profiles_v3() の返り値（投稿者の最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await getCurrentProfile();
  const supabase = await createClient();

  const { data: announcement } = await supabase.from("announcements").select("*").eq("id", id).maybeSingle();
  if (!announcement) notFound();

  const { data: profileData } = await supabase.rpc("event_community_profiles_v3", {
    profile_ids: [announcement.created_by],
  });
  const profiles = (profileData ?? []) as CommunityProfile[];
  const author = profiles.find((member) => member.id === announcement.created_by);

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5">
      <BackButton fallbackHref="/" className="-ml-2" />
      {announcement.cover_image_url && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
          <Image
            src={announcement.cover_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 42rem"
            className="object-cover"
          />
        </div>
      )}
      <header className="pb-5">
        <p className="text-xs text-muted-foreground">
          {new Date(announcement.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{announcement.title}</h1>
        {(announcement.tags ?? []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {announcement.tags.map((tag: string) => (
              <Badge
                key={tag}
                variant={isImportantTag(tag) ? "destructive" : "secondary"}
                className="border-0"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          {author?.avatar_url ? (
            <Image src={author.avatar_url} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
              {author?.full_name?.charAt(0) ?? "?"}
            </span>
          )}
          <span className="text-sm font-medium">{author?.full_name ?? "RA"}</span>
        </div>
      </header>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement.body}</ReactMarkdown>
      </div>
    </article>
  );
}
