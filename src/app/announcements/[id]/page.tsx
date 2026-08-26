import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { BackButton } from "@/components/layout/back-button";
import { Badge } from "@/components/ui/badge";
import { AnnouncementComments } from "@/components/community/announcement-comments";
import { isImportantTag } from "@/lib/utils";
import type { AnnouncementRow } from "@/types/database";

/** event_community_profiles_v3() の返り値（投稿者の最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

type OtherAnnouncement = Pick<AnnouncementRow, "id" | "title" | "pinned" | "created_at">;

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const [{ data: announcement }, { data: allAnnouncements }, { data: commentRows }] = await Promise.all([
    supabase.from("announcements").select("*").eq("id", id).maybeSingle(),
    // 前後移動・他のお知らせ一覧は、ホームと同じ並び順（固定→新着順）で全件取得して算出する。
    // 件数が多くない前提のシンプルな実装。
    supabase
      .from("announcements")
      .select("id, title, pinned, created_at")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("announcement_comments").select("*").eq("announcement_id", id).order("created_at", { ascending: false }),
  ]);
  if (!announcement) notFound();

  const commentIds = (commentRows ?? []).map((comment) => comment.id);
  const commentUserIds = [...new Set((commentRows ?? []).map((comment) => comment.user_id))];

  const [{ data: authorProfileData }, { data: commentUsers }, { data: commentLikes }] = await Promise.all([
    supabase.rpc("event_community_profiles_v3", { profile_ids: [announcement.created_by] }),
    commentUserIds.length
      ? supabase.rpc("event_community_profiles_v3", { profile_ids: commentUserIds })
      : Promise.resolve({ data: null }),
    commentIds.length
      ? supabase.from("announcement_comment_likes").select("comment_id, user_id").in("comment_id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = (authorProfileData ?? []) as CommunityProfile[];
  const author = profiles.find((member) => member.id === announcement.created_by);

  const commentUsersById = new Map(((commentUsers ?? []) as CommunityProfile[]).map((user) => [user.id, user]));
  const comments = (commentRows ?? []).map((comment) => ({
    ...comment,
    user: commentUsersById.get(comment.user_id) ?? null,
    likeCount: (commentLikes ?? []).filter((like) => like.comment_id === comment.id).length,
    likedByMe: (commentLikes ?? []).some((like) => like.comment_id === comment.id && like.user_id === profile.id),
  }));

  // 固定→新着順の一覧上で、自分の前後にある他のお知らせを求める（前後遷移リンク用）。
  const orderedList = (allAnnouncements ?? []) as OtherAnnouncement[];
  const currentIndex = orderedList.findIndex((a) => a.id === id);
  const prevAnnouncement = currentIndex > 0 ? orderedList[currentIndex - 1] : null;
  const nextAnnouncement =
    currentIndex >= 0 && currentIndex < orderedList.length - 1 ? orderedList[currentIndex + 1] : null;
  const otherAnnouncements = orderedList.filter((a) => a.id !== id).slice(0, 8);

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <article className="flex min-w-0 flex-col gap-5">
        <BackButton fallbackHref="/" className="-ml-2" />
        {announcement.cover_image_url && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
            <Image
              src={announcement.cover_image_url}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 42rem"
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
            <Image
              src={author?.avatar_url || DEFAULT_AVATAR_IMAGE_URL}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-sm font-medium">{author?.full_name ?? "RA"}</span>
          </div>
        </header>
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement.body}</ReactMarkdown>
        </div>

        {/* 前後のお知らせへの遷移リンク（固定→新着順の並びで前後にあるもの）。 */}
        {(prevAnnouncement || nextAnnouncement) && (
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-4">
            {prevAnnouncement ? (
              <Link
                href={`/announcements/${prevAnnouncement.id}`}
                className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border p-2.5 transition-colors hover:bg-secondary/40"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ChevronLeft className="h-3 w-3" />
                  前のお知らせ
                </span>
                <span className="line-clamp-1 text-sm font-medium">{prevAnnouncement.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {nextAnnouncement ? (
              <Link
                href={`/announcements/${nextAnnouncement.id}`}
                className="flex min-w-0 flex-col items-end gap-0.5 rounded-xl border border-border p-2.5 text-right transition-colors hover:bg-secondary/40"
              >
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  次のお知らせ
                  <ChevronRight className="h-3 w-3" />
                </span>
                <span className="line-clamp-1 text-sm font-medium">{nextAnnouncement.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}

        {/* デスクトップではサイドバーに常設するため、ここではモバイル(lg未満)でのみ表示する。 */}
        {otherAnnouncements.length > 0 && (
          <section className="flex flex-col gap-2 border-t border-border pt-5 lg:hidden">
            <h2 className="font-bold">他のお知らせ</h2>
            <OtherAnnouncementsList items={otherAnnouncements} />
          </section>
        )}

        <AnnouncementComments
          announcementId={id}
          comments={comments}
          currentUserId={profile.id}
          isRa={profile.role === "ra"}
        />
      </article>

      {/* デスクトップ専用の他のお知らせサイドバー（lg以上でのみ表示）。 */}
      {otherAnnouncements.length > 0 && (
        <aside className="hidden lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100vh-6rem)] lg:flex-col lg:gap-2 lg:overflow-y-auto lg:pb-4">
          <h2 className="font-bold">他のお知らせ</h2>
          <OtherAnnouncementsList items={otherAnnouncements} />
        </aside>
      )}
    </div>
  );
}

function OtherAnnouncementsList({ items }: { items: OtherAnnouncement[] }) {
  return (
    <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
      {items.map((a) => (
        <Link
          key={a.id}
          href={`/announcements/${a.id}`}
          className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40"
        >
          <span className="line-clamp-1 min-w-0 flex-1 text-sm font-medium">
            {a.pinned && <Badge variant="default" className="mr-1.5 border-0 align-middle">固定</Badge>}
            {a.title}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {new Date(a.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </span>
        </Link>
      ))}
    </div>
  );
}
