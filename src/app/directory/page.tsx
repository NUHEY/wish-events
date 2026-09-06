import { requirePublishedTool } from "@/lib/tool-access";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getDictionary } from "@/lib/i18n";
import { DirectoryList } from "@/components/directory/directory-list";
import { DIRECTORY_FIELDS, type DirectoryFilters } from "@/components/directory/directory-filters";
import type { DirectoryProfileRow } from "@/types/database";

export default async function DirectoryPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const initialFilters: DirectoryFilters = {};
  for (const field of DIRECTORY_FIELDS) {
    const value = searchParams[field];
    if (typeof value === "string") initialFilters[field] = value;
  }
  const profile = await requirePublishedTool("resident_directory");
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
        <p className="text-sm text-muted-foreground">{locale === "en" ? "Find a conversation starter through languages, studies and places you have lived." : "言語・学部・暮らした場所から、話すきっかけを見つけよう。"}</p>
      </div>
      <DirectoryList profiles={profiles} currentUserId={profile.id} initialFilters={initialFilters} />
    </div>
  );
}
