import { requireRa } from "@/lib/auth";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { createAnnouncement } from "@/actions/announcements";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export default async function NewAnnouncementPage() {
  await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const { data: teamMembers } = await supabase.from("users").select("id, full_name, avatar_url").eq("role", "ra").order("full_name");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <BackButton fallbackHref="/" className="-ml-2 self-start" />
      <h1 className="text-xl font-bold">{dict.announcementForm.newTitle}</h1>
      <AnnouncementForm action={createAnnouncement} submitLabel={dict.common.add} teamMembers={teamMembers ?? []} />
    </div>
  );
}
