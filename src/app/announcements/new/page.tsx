import { requireManagement } from "@/lib/management-access";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { createAnnouncement } from "@/actions/announcements";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewAnnouncementPage() {
  await requireManagement("announcements");
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <BackButton fallbackHref="/" className="-ml-2 self-start" />
      <h1 className="text-xl font-bold">{dict.announcementForm.newTitle}</h1>
      <AnnouncementForm action={createAnnouncement} submitLabel={dict.common.add} />
    </div>
  );
}
