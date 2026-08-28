import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hexToHsl } from "@/lib/utils";

export type SiteSettings = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  faviconUrl: string | null;
  appleTouchIconUrl: string | null;
  appShortName: string;
  themeColor: string;
  accentColor: string;
  colorfulStatus: boolean;
  eventLabelRotationEnabled: boolean;
  eventLabelDurationMs: number;
  eventLabelJitterPercent: number;
  eventLabelShuffleEnabled: boolean;
  eventLabelLimit: number;
  eventLabelPosition: "top-left" | "top-right";
  eventShowCategoryLabel: boolean;
  eventShowNewLabel: boolean;
  eventShowDeadlineLabel: boolean;
  eventShowFeeLabel: boolean;
  eventShowFreeLabel: boolean;
  eventDeadlineHours: number;
  eventTitleLines: 1 | 2 | 3;
  eventCardDensity: "compact" | "comfortable";
  navigationLockEnabled: boolean;
  navigationStallSeconds: number;
  mobileTouchFeedbackEnabled: boolean;
  mobileTouchFeedbackMs: number;
  motionLevel: "subtle" | "standard" | "lively";
  ctaBlurPx: number;
  ctaFadeHeightPx: number;
  ctaTransitionMs: number;
  homeToolDensity: "minimal" | "compact";
  scheduleDefaultStartTime: string;
  scheduleDefaultEndTime: string;
  scheduleDefaultSlotMinutes: 15 | 30 | 60;
  scheduleMaxDays: number;
};

export const SITE_DEFAULT_TITLE = "WISH Events";
export const SITE_DEFAULT_DESCRIPTION =
  "早稲田大学国際学生寮 WISH のイベント一覧・申込サイト / Event site for Waseda's WISH international dorm";

/**
 * サイトのアクセントカラー既定値。早稲田大学が2007年のUIシステム導入時に定めた
 * 公式の「早稲田レッド（臙脂色）」相当の色（DIC 2486 / PANTONE 202C）を採用している。
 */
export const SITE_DEFAULT_ACCENT_COLOR = "#8E1728";

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const SITE_SETTINGS_DEFAULTS: SiteSettings = {
  ogTitle: null,
  ogDescription: null,
  ogImageUrl: null,
  faviconUrl: null,
  appleTouchIconUrl: null,
  appShortName: "WISH",
  themeColor: "#8E1728",
  accentColor: SITE_DEFAULT_ACCENT_COLOR,
  colorfulStatus: false,
  eventLabelRotationEnabled: true,
  eventLabelDurationMs: 3600,
  eventLabelJitterPercent: 18,
  eventLabelShuffleEnabled: true,
  eventLabelLimit: 0,
  eventLabelPosition: "top-left",
  eventShowCategoryLabel: true,
  eventShowNewLabel: true,
  eventShowDeadlineLabel: true,
  eventShowFeeLabel: true,
  eventShowFreeLabel: true,
  eventDeadlineHours: 48,
  eventTitleLines: 2,
  eventCardDensity: "compact",
  navigationLockEnabled: true,
  navigationStallSeconds: 8,
  mobileTouchFeedbackEnabled: true,
  mobileTouchFeedbackMs: 180,
  motionLevel: "standard",
  ctaBlurPx: 16,
  ctaFadeHeightPx: 64,
  ctaTransitionMs: 200,
  homeToolDensity: "minimal",
  scheduleDefaultStartTime: "09:00",
  scheduleDefaultEndTime: "21:00",
  scheduleDefaultSlotMinutes: 30,
  scheduleMaxDays: 31,
};

function numberSetting(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function booleanSetting(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * OGP用のタイトル・説明・画像、サイトのアクセントカラー・状態色（エラー/成功/NEW等）を
 * 色付きにするかどうか。RAダッシュボード（/dashboard/settings）から編集できる。
 * テーブル未作成・取得失敗・未設定の場合は既定の文言/色にフォールバックする
 * （ページ表示自体は絶対に壊さない）。
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      // select("*")なら、新しい設定列のSQLが未適用でも既存のOGP設定まで
      // まとめて取得失敗せず、存在する列だけを安全に利用できる。
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const row = (data ?? {}) as Record<string, unknown>;
    const accent = typeof row.accent_color === "string" ? row.accent_color : "";
    const accentColor = HEX_PATTERN.test(accent) ? accent : SITE_DEFAULT_ACCENT_COLOR;
    return {
      ogTitle: typeof row.og_title === "string" ? row.og_title.trim() || null : null,
      ogDescription: typeof row.og_description === "string" ? row.og_description.trim() || null : null,
      ogImageUrl: typeof row.og_image_url === "string" ? row.og_image_url : null,
      faviconUrl: typeof row.favicon_url === "string" ? row.favicon_url : null,
      appleTouchIconUrl: typeof row.apple_touch_icon_url === "string" ? row.apple_touch_icon_url : null,
      appShortName: typeof row.app_short_name === "string" && row.app_short_name.trim() ? row.app_short_name.trim().slice(0, 20) : SITE_SETTINGS_DEFAULTS.appShortName,
      themeColor: typeof row.theme_color === "string" && HEX_PATTERN.test(row.theme_color) ? row.theme_color : SITE_SETTINGS_DEFAULTS.themeColor,
      accentColor,
      colorfulStatus: booleanSetting(row.colorful_status, SITE_SETTINGS_DEFAULTS.colorfulStatus),
      eventLabelRotationEnabled: booleanSetting(row.event_label_rotation_enabled, SITE_SETTINGS_DEFAULTS.eventLabelRotationEnabled),
      eventLabelDurationMs: numberSetting(row.event_label_duration_ms, SITE_SETTINGS_DEFAULTS.eventLabelDurationMs, 1800, 12000),
      eventLabelJitterPercent: numberSetting(row.event_label_jitter_percent, SITE_SETTINGS_DEFAULTS.eventLabelJitterPercent, 0, 45),
      eventLabelShuffleEnabled: booleanSetting(row.event_label_shuffle_enabled, SITE_SETTINGS_DEFAULTS.eventLabelShuffleEnabled),
      eventLabelLimit: numberSetting(row.event_label_limit, SITE_SETTINGS_DEFAULTS.eventLabelLimit, 0, 50),
      eventLabelPosition: row.event_label_position === "top-right" ? "top-right" : "top-left",
      eventShowCategoryLabel: booleanSetting(row.event_show_category_label, SITE_SETTINGS_DEFAULTS.eventShowCategoryLabel),
      eventShowNewLabel: booleanSetting(row.event_show_new_label, SITE_SETTINGS_DEFAULTS.eventShowNewLabel),
      eventShowDeadlineLabel: booleanSetting(row.event_show_deadline_label, SITE_SETTINGS_DEFAULTS.eventShowDeadlineLabel),
      eventShowFeeLabel: booleanSetting(row.event_show_fee_label, SITE_SETTINGS_DEFAULTS.eventShowFeeLabel),
      eventShowFreeLabel: booleanSetting(row.event_show_free_label, SITE_SETTINGS_DEFAULTS.eventShowFreeLabel),
      eventDeadlineHours: numberSetting(row.event_deadline_hours, SITE_SETTINGS_DEFAULTS.eventDeadlineHours, 1, 168),
      eventTitleLines: numberSetting(row.event_title_lines, SITE_SETTINGS_DEFAULTS.eventTitleLines, 1, 3) as 1 | 2 | 3,
      eventCardDensity: row.event_card_density === "comfortable" ? "comfortable" : "compact",
      navigationLockEnabled: booleanSetting(row.navigation_lock_enabled, SITE_SETTINGS_DEFAULTS.navigationLockEnabled),
      navigationStallSeconds: numberSetting(row.navigation_stall_seconds, SITE_SETTINGS_DEFAULTS.navigationStallSeconds, 3, 30),
      mobileTouchFeedbackEnabled: booleanSetting(row.mobile_touch_feedback_enabled, SITE_SETTINGS_DEFAULTS.mobileTouchFeedbackEnabled),
      mobileTouchFeedbackMs: numberSetting(row.mobile_touch_feedback_ms, SITE_SETTINGS_DEFAULTS.mobileTouchFeedbackMs, 80, 500),
      motionLevel: row.motion_level === "subtle" || row.motion_level === "lively" ? row.motion_level : "standard",
      ctaBlurPx: numberSetting(row.cta_blur_px, SITE_SETTINGS_DEFAULTS.ctaBlurPx, 0, 32),
      ctaFadeHeightPx: numberSetting(row.cta_fade_height_px, SITE_SETTINGS_DEFAULTS.ctaFadeHeightPx, 32, 128),
      ctaTransitionMs: numberSetting(row.cta_transition_ms, SITE_SETTINGS_DEFAULTS.ctaTransitionMs, 100, 600),
      homeToolDensity: row.home_tool_density === "compact" ? "compact" : "minimal",
      scheduleDefaultStartTime: typeof row.schedule_default_start_time === "string" ? row.schedule_default_start_time.slice(0, 5) : SITE_SETTINGS_DEFAULTS.scheduleDefaultStartTime,
      scheduleDefaultEndTime: typeof row.schedule_default_end_time === "string" ? row.schedule_default_end_time.slice(0, 5) : SITE_SETTINGS_DEFAULTS.scheduleDefaultEndTime,
      scheduleDefaultSlotMinutes: ([15, 30, 60].includes(Number(row.schedule_default_slot_minutes)) ? Number(row.schedule_default_slot_minutes) : SITE_SETTINGS_DEFAULTS.scheduleDefaultSlotMinutes) as 15 | 30 | 60,
      scheduleMaxDays: numberSetting(row.schedule_max_days, SITE_SETTINGS_DEFAULTS.scheduleMaxDays, 3, 31),
    };
  } catch {
    return SITE_SETTINGS_DEFAULTS;
  }
});

function clampPct(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 管理者が選んだ1色（HEX）から、ライト/ダーク各モードの --primary / --primary-hover を
 * 導出する。選んだ色の彩度・明度をできるだけ忠実に活かしつつ、白文字ボタンとして
 * 十分なコントラストを保てる範囲だけクランプする（浅すぎる/暗すぎる色を選んでも
 * 読めなくならないようにするための安全策で、色そのものを勝手に薄めるものではない）。
 */
export function buildAccentPalette(hex: string) {
  const { h, s, l } = hexToHsl(HEX_PATTERN.test(hex) ? hex : SITE_DEFAULT_ACCENT_COLOR);
  const satLight = clampPct(s, 30, 85);
  const lightL = clampPct(l, 30, 52);
  const satDark = clampPct(s + 6, 34, 88);
  const darkL = clampPct(l + 26, 52, 70);
  return {
    light: `${h} ${satLight}% ${lightL}%`,
    lightHover: `${h} ${clampPct(satLight + 3, 30, 90)}% ${clampPct(lightL - 7, 22, 46)}%`,
    dark: `${h} ${satDark}% ${darkL}%`,
    darkHover: `${h} ${clampPct(satDark + 2, 34, 92)}% ${clampPct(darkL + 6, 56, 76)}%`,
  };
}

/** 「状態に色を使う」がオンの場合に復元する、元々の（エラー赤・成功緑・NEW青の）配色。 */
const COLORFUL_STATUS_CSS = `
:root{--destructive:0 64% 48%;--destructive-foreground:0 0% 100%;--success:153 42% 38%;--success-foreground:0 0% 100%;--info:203 58% 48%;--info-foreground:0 0% 100%;}
.dark{--destructive:0 66% 56%;--destructive-foreground:0 0% 100%;--success:155 55% 42%;--success-foreground:0 0% 100%;--info:202 75% 52%;--info-foreground:224 16% 9%;}
`;

/**
 * layout.tsx の <head> に注入するサイト全体のテーマ上書きCSS。
 * アクセントカラーは常にこれで反映し、状態色は「色を使う」設定がオンの時だけ
 * 既定のモノクロから元の配色に戻す。
 */
export function buildSiteThemeStyle(settings: SiteSettings): string {
  const accent = buildAccentPalette(settings.accentColor);
  const motionDistance = settings.motionLevel === "subtle" ? 2 : settings.motionLevel === "lively" ? 7 : 5;
  return `:root{--primary:${accent.light};--primary-hover:${accent.lightHover};--ring:${accent.light};--mobile-touch-duration:${settings.mobileTouchFeedbackMs}ms;--mobile-touch-animation:${settings.mobileTouchFeedbackEnabled ? "mobile-touch-feedback" : "none"};--motion-distance:${motionDistance}px;--cta-blur:${settings.ctaBlurPx}px;--cta-fade-height:${settings.ctaFadeHeightPx}px;--cta-transition-duration:${settings.ctaTransitionMs}ms;}
.dark{--primary:${accent.dark};--primary-hover:${accent.darkHover};--ring:${accent.dark};}
${settings.colorfulStatus ? COLORFUL_STATUS_CSS : ""}`;
}
