"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pin, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteAnnouncement } from "@/actions/announcements";
import { useDict } from "@/lib/i18n/locale-provider";
import type { AnnouncementRow } from "@/types/database";

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
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden rounded-2xl transition-shadow duration-200 hover:shadow-card-hover">
      {announcement.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={announcement.cover_image_url}
          alt=""
          className="aspect-[16/9] w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {announcement.pinned && (
            <Badge variant="default" className="gap-1">
              <Pin className="h-3 w-3" />
              {dict.announcementForm.pinnedBadge}
            </Badge>
          )}
          {announcement.category_label && (
            <Badge variant="secondary">{announcement.category_label}</Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(announcement.created_at).toLocaleDateString("ja-JP")}
          </span>
        </div>
        <h3 className="text-lg font-semibold leading-snug">{announcement.title}</h3>
        <div className="prose prose-sm max-w-none text-foreground/90">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{announcement.body}</ReactMarkdown>
        </div>
        {isRa && (
          <div className="mt-2 flex gap-2 border-t border-border pt-3">
            <Link
              href={`/announcements/${announcement.id}/edit`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
              {dict.common.edit}
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {dict.common.delete}
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
