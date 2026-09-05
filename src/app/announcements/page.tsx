import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getLocale, getDictionary } from "@/lib/i18n";
import { BackButton } from "@/components/layout/back-button";
import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { AnnouncementRow } from "@/types/database";

/** ホームの「お知らせ」（直近3件のみ表示）から「すべて見る」で遷移する一覧ページ。 */
export default async function AnnouncementsListPage() {
  const profile = await getCurrentProfile();
  const canManageModule = canManage(await getManagementAccess(), "announcements");
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const isRa = canManageModule;

  const { data: announcements, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <BackButton fallbackHref="/" className="-ml-2" />
        {isRa && (
          <Link
            href="/announcements/new"
            className={buttonVariants({ size: "sm", className: "gap-1" })}
          >
            <Plus className="h-4 w-4" />
            {dict.homeFeed.newButton}
          </Link>
        )}
      </div>

      <h1 className="text-lg font-bold">{dict.homeFeed.title}</h1>

      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {dict.home.loadError}: {error.message}
        </p>
      )}

      {announcements && announcements.length === 0 && (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border bg-secondary/40 py-16 text-center">
          <p className="text-sm font-medium">{dict.homeFeed.empty}</p>
          <p className="text-xs text-muted-foreground">{dict.homeFeed.emptyHint}</p>
        </div>
      )}

      {announcements && announcements.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {(announcements as AnnouncementRow[]).map((a) => (
            <AnnouncementCard key={a.id} announcement={a} isRa={isRa} />
          ))}
        </div>
      )}
    </div>
  );
}
