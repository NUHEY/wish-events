import { requireRa } from "@/lib/auth";
import { getSiteSettings, SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_ACCENT_COLOR } from "@/lib/site-settings";
import { SiteSettingsForm } from "@/components/dashboard/site-settings-form";

export default async function SiteSettingsPage() {
  await requireRa();
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">サイト設定</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          共有時の表示、サイトカラー、画面遷移、タッチ操作、固定ボタンを管理します。
        </p>
      </div>
      <SiteSettingsForm
        initialTitle={settings.ogTitle ?? ""}
        initialDescription={settings.ogDescription ?? ""}
        initialImageUrl={settings.ogImageUrl}
        defaultTitle={SITE_DEFAULT_TITLE}
        defaultDescription={SITE_DEFAULT_DESCRIPTION}
        initialAccentColor={settings.accentColor}
        initialColorfulStatus={settings.colorfulStatus}
        defaultAccentColor={SITE_DEFAULT_ACCENT_COLOR}
        navigationLockEnabled={settings.navigationLockEnabled}
        navigationStallSeconds={settings.navigationStallSeconds}
        mobileTouchFeedbackEnabled={settings.mobileTouchFeedbackEnabled}
        mobileTouchFeedbackMs={settings.mobileTouchFeedbackMs}
        motionLevel={settings.motionLevel}
        ctaBlurPx={settings.ctaBlurPx}
        ctaFadeHeightPx={settings.ctaFadeHeightPx}
        ctaTransitionMs={settings.ctaTransitionMs}
      />
    </div>
  );
}
