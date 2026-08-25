import { requireRa } from "@/lib/auth";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { createAnnouncement } from "@/actions/announcements";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function DashboardNewAnnouncementPage() {
  await requireRa(); const locale = await getLocale(); const dict = getDictionary(locale);
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><h2 className="text-xl font-bold">{dict.announcementForm.newTitle}</h2><AnnouncementForm action={createAnnouncement} submitLabel={dict.common.add} /></div>;
}
