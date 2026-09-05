import { EventDisplaySettingsForm } from "@/components/dashboard/event-display-settings-form";
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
        <h1 className="text-2xl font-bold">サイトの表示・操作</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          サイト全体の見え方を目的別に調整できます。ホームの掲載順は「ホームの編集」、自分だけの言語・明るさは「自分の設定」で変更します。
        </p>
      </div>
      <nav aria-label="設定する内容" className="grid grid-cols-2 gap-2">{[
        ["#site-icons", "アイコン"], ["#site-sharing", "共有時の画像"], ["#site-appearance", "名前・色"],
        ["#site-interaction", "スマホの操作感"], ["#event-appearance", "イベント一覧"], ["#schedule-defaults", "日程の初期設定"],
      ].map(([href, label]) => <a key={href} href={href} className="flex min-h-11 items-center rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">{label}</a>)}</nav>
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
      <EventDisplaySettingsForm settings={settings} />
      <div id="schedule-defaults" className="scroll-mt-24"><ScheduleToolSettings initial={{ startTime: settings.scheduleDefaultStartTime, endTime: settings.scheduleDefaultEndTime, slotMinutes: settings.scheduleDefaultSlotMinutes, maxDays: settings.scheduleMaxDays }} /></div>
    </div>
  );
}
