import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HomeLayoutEditor } from "@/components/home/home-layout-editor";
import { getLocale, getDictionary } from "@/lib/i18n";
import { HOME_SECTION_KEYS } from "@/lib/constants";

export default async function HomeLayoutPage() {
  await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const { data: sections } = await supabase
    .from("home_layout_sections")
    .select("*")
    .order("position", { ascending: true });

  // 万が一シード行が欠けている場合に備えたフォールバック（通常は発生しない）
  const safeSections =
    sections && sections.length === HOME_SECTION_KEYS.length
      ? sections
      : HOME_SECTION_KEYS.map((key, i) => ({
          id: key,
          section_key: key,
          visible: true,
          position: i + 1,
          accent: null,
          title_ja: null,
          title_en: null,
          updated_at: new Date(0).toISOString(),
        }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{dict.homeLayout.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.homeLayout.subtitle}</p>
      </div>

      <HomeLayoutEditor initialSections={safeSections} />
    </div>
  );
}
