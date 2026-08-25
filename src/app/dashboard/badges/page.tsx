import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BadgeManager } from "@/components/dashboard/badge-manager";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";
import type { BadgeRow } from "@/types/database";

export default async function BadgesAdminPage() {
  await requireRa();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const { data: badges } = await supabase.from("badges").select("*").order("sort_order", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallbackHref="/dashboard" className="-ml-2 self-start" />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{dict.badgeAdmin.title}</h1>
        <p className="text-sm text-muted-foreground">{dict.badgeAdmin.subtitle}</p>
      </div>
      <BadgeManager badges={(badges as BadgeRow[]) ?? []} />
    </div>
  );
}
