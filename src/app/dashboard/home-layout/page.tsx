import { getManagementAccess, requireManagement } from "@/lib/management-access";
import Link from "next/link";
import { canManage } from "@/lib/management-permissions";
import { createClient } from "@/lib/supabase/server";
import { HomeLayoutEditor } from "@/components/home/home-layout-editor";
import { HomeToolEditor } from "@/components/home/home-tool-editor";
import { getLocale, getDictionary } from "@/lib/i18n";
import { HOME_SECTION_KEYS } from "@/lib/constants";
import { RESIDENT_TOOLS } from "@/components/tools/resident-tool-grid";
import { getSiteSettings } from "@/lib/site-settings";

export default async function HomeLayoutPage() {
  await requireManagement("home");
  const access = await getManagementAccess();
  const canEditTools = canManage(access, "features") && canManage(access, "settings");
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [{ data: sections, error: sectionsError }, { data: toolRows, error: toolsError }, settings] = await Promise.all([
    supabase.from("home_layout_sections").select("*").order("position", { ascending: true }),
    supabase.from("feature_flags").select("key,state,show_on_home,home_position").in("key", RESIDENT_TOOLS.map((tool) => tool.key)),
    getSiteSettings(),
  ]);

  if (sectionsError) throw sectionsError;
  if (toolsError) throw toolsError;

  // 万が一シード行が欠けている場合に備えたフォールバック（通常は発生しない）
  const byKey = new Map((sections ?? []).map((section) => [section.section_key, section]));
  const safeSections = HOME_SECTION_KEYS.map((key, i) => byKey.get(key) ?? ({
    id: key,
    section_key: key,
    visible: true,
    position: i + 1,
    accent: null,
    title_ja: null,
    title_en: null,
    updated_at: new Date(0).toISOString(),
  })).sort((a, b) => a.position - b.position);
  const toolByKey = new Map((toolRows ?? []).map((row) => [row.key, row]));
  const homeTools = RESIDENT_TOOLS.map((tool, index) => {
    const row = toolByKey.get(tool.key);
    return { key: tool.key, state: row?.state ?? "hidden", showOnHome: row?.show_on_home ?? true, position: row?.home_position || index + 1 };
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{dict.homeLayout.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{locale === "en" ? "Choose what residents see first. Save the section layout and tool settings separately." : "寮生が最初に見る情報を選びます。「ホームの並び順」と「便利ツール欄」は、それぞれの保存ボタンで反映します。"}</p>
        <Link href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-primary underline underline-offset-4">{locale === "en" ? "Open the saved home page in a new tab" : "保存済みのホームを別タブで確認"}</Link>
      </div>

      <HomeLayoutEditor initialSections={safeSections} />
      {canEditTools ? <HomeToolEditor initialTools={homeTools} initialDensity={settings.homeToolDensity} /> : <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{locale === "en" ? "Changing tool visibility and density also requires Feature visibility and Site appearance permissions." : "便利ツールの公開範囲・表示密度を変更するには、「機能の公開範囲」と「サイトの表示設定」の権限も必要です。"}</p>}
    </div>
  );
}
