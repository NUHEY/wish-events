import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SiteSettings = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
};

export const SITE_DEFAULT_TITLE = "WISH Events";
export const SITE_DEFAULT_DESCRIPTION =
  "早稲田大学国際学生寮 WISH のイベント一覧・申込サイト / Event site for Waseda's WISH international dorm";

/**
 * OGP用のタイトル・説明・画像。RAダッシュボード（/dashboard/settings）から編集できる。
 * テーブル未作成・取得失敗・未設定の場合は既定の文言/画像にフォールバックする
 * （ページ表示自体は絶対に壊さない）。
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("site_settings")
      .select("og_title, og_description, og_image_url")
      .eq("id", 1)
      .maybeSingle();
    return {
      ogTitle: data?.og_title?.trim() || null,
      ogDescription: data?.og_description?.trim() || null,
      ogImageUrl: data?.og_image_url || null,
    };
  } catch {
    return { ogTitle: null, ogDescription: null, ogImageUrl: null };
  }
});
