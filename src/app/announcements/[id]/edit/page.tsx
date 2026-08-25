import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AnnouncementForm } from "@/components/announcements/announcement-form";
import { updateAnnouncement } from "@/actions/announcements";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const { data: announcement } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!announcement) notFound();

  const updateWithId = updateAnnouncement.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <BackButton fallbackHref="/" className="-ml-2 self-start" />
      <h1 className="text-xl font-bold">{dict.announcementForm.editTitle}</h1>
      <AnnouncementForm
        action={updateWithId}
        initialAnnouncement={announcement}
        submitLabel={dict.common.save}
      />
    </div>
  );
}
