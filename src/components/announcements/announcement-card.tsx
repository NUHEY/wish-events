"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pin, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { deleteAnnouncement } from "@/actions/announcements";
import { useDict } from "@/lib/i18n/locale-provider";
import { isImportantTag } from "@/lib/utils";
import type { AnnouncementRow } from "@/types/database";

/** お知らせ一覧の1行。「セル」感を避け、パディングを抑えたリスト行として表示する。 */
export function AnnouncementCard({
  announcement,
  isRa,
}: {
  announcement: AnnouncementRow;
  isRa: boolean;
}) {
  const dict = useDict();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(dict.announcementForm.confirmDelete)) return;
    startTransition(async () => {
      await deleteAnnouncement(announcement.id);
      toast.success(dict.toast.deleted);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-secondary/40">
      <Link href={`/announcements/${announcement.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {announcement.pinned && (
            <Badge variant="default" className="gap-1 border-0">
              <Pin className="h-3 w-3" />
              {dict.announcementForm.pinnedBadge}
            </Badge>
          )}
          {(announcement.tags ?? []).map((tag) => (
            <Badge
              key={tag}
              variant={isImportantTag(tag) ? "destructive" : "secondary"}
              className="border-0"
            >
              {tag}
            </Badge>
          ))}
          {announcement.category_label && (
            <span className="text-xs text-muted-foreground">{announcement.category_label}</span>
          )}
        </div>
        <span className="line-clamp-1 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary">
          {announcement.title}
        </span>
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground">
        {new Date(announcement.created_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
      </span>
      {isRa && (
        <div className="hidden shrink-0 gap-2.5 sm:flex">
          <Link
            href={`/announcements/${announcement.id}/edit`}
            className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
            aria-label={dict.common.edit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="inline-flex items-center text-muted-foreground transition-colors hover:text-destructive"
            aria-label={dict.common.delete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
