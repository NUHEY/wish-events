import { getManagementAccess, requireManagement } from "@/lib/management-access";
import Link from "next/link";
import { ExternalLink, LayoutList, Sparkles } from "lucide-react";
import { canManage } from "@/lib/management-permissions";
import { createClient } from "@/lib/supabase/server";
import { HomeLayoutEditor } from "@/components/home/home-layout-editor";
import { HomeToolEditor } from "@/components/home/home-tool-editor";
import { getLocale, getDictionary } from "@/lib/i18n";
import { HOME_SECTION_KEYS } from "@/lib/constants";
import { RESIDENT_TOOLS, resolveHomeTools } from "@/lib/resident-tools";
import { getSiteSettings } from "@/lib/site-settings";

export default async function HomeLayoutPage() {
  await requireManagement("home");
  const access = await getManagementAccess();
  const canEditTools = canManage(access, "settings");
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [{ data: sections, error: sectionsError }, { data: toolRows, error: toolsError }, settings] = await Promise.all([
    supabase.from("home_layout_sections").select("*").order("position", { ascending: true }),
    supabase.from("feature_flags").select("key,state,show_on_home,home_position").in("key", RESIDENT_TOOLS.flatMap(tool => tool.featureKey ? [tool.featureKey] : [])),
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
  const homeTools = resolveHomeTools(settings.homeToolLayout, toolRows ?? []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{dict.homeLayout.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{locale === "en" ? "Choose the sections and tools residents see. Save each group after editing." : "ホームに載せる情報とツールを選びます。変更した欄の下で保存してください。"}</p>
        <Link href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"><ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />{locale === "en" ? "View saved home page" : "保存済みのホームを見る"}</Link>
      </div>

      {canEditTools && <nav aria-label={locale === "en" ? "Home editing sections" : "ホーム編集の項目"} className="grid grid-cols-2 gap-2">
        <a href="#home-sections" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-2 text-sm font-medium hover:bg-secondary"><LayoutList aria-hidden="true" className="h-4 w-4 shrink-0" />{locale === "en" ? "Sections" : "セクション"}</a>
        <a href="#home-tools" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-2 text-sm font-medium hover:bg-secondary"><Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />{locale === "en" ? "Tools" : "ツール"}</a>
      </nav>}
      <HomeLayoutEditor initialSections={safeSections} />
      {canEditTools ? <HomeToolEditor initialTools={homeTools} initialDensity={settings.homeToolDensity} /> : <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{locale === "en" ? "Editing the tools shown on home also requires Site appearance permission." : "ホームに載せるツールを変更するには、「サイトの表示設定」の権限も必要です。"}</p>}
    </div>
  );
}
