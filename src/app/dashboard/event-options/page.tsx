import { requireManagement } from "@/lib/management-access";
import { createClient } from "@/lib/supabase/server";
import { EventOptionManager } from "@/components/dashboard/event-option-manager";
import {
  addLocationOption,
  addAudienceOption,
  removeLocationOption,
  removeAudienceOption,
} from "@/actions/event-options";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getSiteSettings } from "@/lib/site-settings";
import { EventDisplaySettingsForm } from "@/components/dashboard/event-display-settings-form";

export default async function EventOptionsPage() {
  await requireManagement("event_options");
  const supabase = await createClient();
  const [locale, settings] = await Promise.all([getLocale(), getSiteSettings()]);
  const dict = getDictionary(locale);

  const [{ data: locations }, { data: audiences }] = await Promise.all([
    supabase.from("event_location_options").select("*").order("position", { ascending: true }),
    supabase.from("event_audience_options").select("*").order("position", { ascending: true }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">イベント設定</h1>
        <p className="text-sm text-muted-foreground">イベント一覧の表示と、作成フォームで使う選択肢を管理します。</p>
      </div>

      <EventDisplaySettingsForm settings={settings} />

      <div className="border-t border-border pt-6"><h2 className="text-lg font-bold">作成フォームの選択肢</h2><p className="mt-1 text-sm text-muted-foreground">会場と対象者の候補を管理します。</p></div>

      <EventOptionManager
        title={dict.eventOptions.locationTitle}
        subtitle={dict.eventOptions.locationSubtitle}
        options={locations ?? []}
        addAction={addLocationOption}
        removeAction={removeLocationOption}
        labelJaPlaceholder={dict.eventOptions.labelJaPlaceholder}
        labelEnPlaceholder={dict.eventOptions.labelEnPlaceholder}
        addButtonLabel={dict.eventOptions.addButton}
        emptyLabel={dict.eventOptions.emptyLabel}
      />

      <EventOptionManager
        title={dict.eventOptions.audienceTitle}
        subtitle={dict.eventOptions.audienceSubtitle}
        options={audiences ?? []}
        addAction={addAudienceOption}
        removeAction={removeAudienceOption}
        labelJaPlaceholder={dict.eventOptions.labelJaPlaceholder}
        labelEnPlaceholder={dict.eventOptions.labelEnPlaceholder}
        addButtonLabel={dict.eventOptions.addButton}
        emptyLabel={dict.eventOptions.emptyLabel}
      />
    </div>
  );
}
