import { requireRa } from "@/lib/auth";
import { getSiteSettings, SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION } from "@/lib/site-settings";
import { SiteSettingsForm } from "@/components/dashboard/site-settings-form";

export default async function SiteSettingsPage() {
  await requireRa();
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">サイト設定</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          URLを共有した際に表示されるタイトル・説明・プレビュー画像（OGP）を管理します。
        </p>
      </div>
      <SiteSettingsForm
        initialTitle={settings.ogTitle ?? ""}
        initialDescription={settings.ogDescription ?? ""}
        initialImageUrl={settings.ogImageUrl}
        defaultTitle={SITE_DEFAULT_TITLE}
        defaultDescription={SITE_DEFAULT_DESCRIPTION}
      />
    </div>
  );
}
