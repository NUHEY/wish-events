import { ScheduleToolSettings } from "@/components/dashboard/schedule-tool-settings";
import { requireManagement } from "@/lib/management-access";
import { getSiteSettings, SITE_DEFAULT_TITLE, SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_ACCENT_COLOR } from "@/lib/site-settings";
import { SiteSettingsForm } from "@/components/dashboard/site-settings-form";

export default async function SiteSettingsPage() {
  await requireManagement("settings");
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">サイト設定</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          アイコン、共有時の名前・画像、サイトの色を設定します。タップや動きの調整は「操作・動きの詳細設定」にまとめています。
        </p>
      </div>
      <SiteSettingsForm
        initialTitle={settings.ogTitle ?? ""}
        initialDescription={settings.ogDescription ?? ""}
        initialImageUrl={settings.ogImageUrl}
        initialFaviconUrl={settings.faviconUrl}
        initialAppleTouchIconUrl={settings.appleTouchIconUrl}
        initialAppShortName={settings.appShortName}
        initialThemeColor={settings.themeColor}
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
      <div id="schedule-defaults" className="scroll-mt-24"><ScheduleToolSettings initial={{ startTime: settings.scheduleDefaultStartTime, endTime: settings.scheduleDefaultEndTime, slotMinutes: settings.scheduleDefaultSlotMinutes, maxDays: settings.scheduleMaxDays }} /></div>
    </div>
  );
}
