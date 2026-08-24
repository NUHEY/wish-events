import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getDictionary } from "@/lib/i18n";
import { DirectoryList } from "@/components/directory/directory-list";
import type { DirectoryProfileRow } from "@/types/database";

export default async function DirectoryPage() {
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();

  // email/student_id/line_qr_pathを含まない専用関数（RLSに関わらず全寮生分を返す）。
  const { data } = await supabase.rpc("directory_profiles");
  const profiles = (data ?? []) as DirectoryProfileRow[];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{dict.directory.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.directory.subtitle}</p>
      </div>
      <DirectoryList profiles={profiles} currentUserId={profile.id} />
    </div>
  );
}
