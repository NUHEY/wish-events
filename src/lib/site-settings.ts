import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { hexToHsl } from "@/lib/utils";

export type SiteSettings = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  accentColor: string;
  colorfulStatus: boolean;
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
      .select("og_title, og_description, og_image_url, accent_color, colorful_status")
      .eq("id", 1)
      .maybeSingle();
    const accentColor = data?.accent_color && HEX_PATTERN.test(data.accent_color) ? data.accent_color : SITE_DEFAULT_ACCENT_COLOR;
    return {
      ogTitle: data?.og_title?.trim() || null,
      ogDescription: data?.og_description?.trim() || null,
      ogImageUrl: data?.og_image_url || null,
      accentColor,
      colorfulStatus: !!data?.colorful_status,
    };
  } catch {
    return { ogTitle: null, ogDescription: null, ogImageUrl: null, accentColor: SITE_DEFAULT_ACCENT_COLOR, colorfulStatus: false };
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
  return `:root{--primary:${accent.light};--primary-hover:${accent.lightHover};--ring:${accent.light};}
.dark{--primary:${accent.dark};--primary-hover:${accent.darkHover};--ring:${accent.dark};}
${settings.colorfulStatus ? COLORFUL_STATUS_CSS : ""}`;
}
