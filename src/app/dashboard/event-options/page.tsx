import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventOptionManager } from "@/components/dashboard/event-option-manager";
import { BackButton } from "@/components/layout/back-button";
import {
  addLocationOption,
  addAudienceOption,
  removeLocationOption,
  removeAudienceOption,
} from "@/actions/event-options";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EventOptionsPage() {
  await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [{ data: locations }, { data: audiences }] = await Promise.all([
    supabase.from("event_location_options").select("*").order("position", { ascending: true }),
    supabase.from("event_audience_options").select("*").order("position", { ascending: true }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <BackButton fallbackHref="/dashboard" className="-ml-2 self-start" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{dict.eventOptions.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.eventOptions.subtitle}</p>
      </div>

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
