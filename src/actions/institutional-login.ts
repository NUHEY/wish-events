"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import type { UserAccountKind } from "@/types/database";

export type InstitutionalAccountKind = Exclude<UserAccountKind, "resident">;
export type InstitutionalLoginResult = { error?: string } | void;

const WASEDA_EMAIL_REGEX = /^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$/i;

function credentialsFor(kind: InstitutionalAccountKind) {
  if (kind === "service_desk") {
    return {
      email: process.env.INSTITUTIONAL_SERVICE_DESK_EMAIL,
      password: process.env.INSTITUTIONAL_SERVICE_DESK_PASSWORD,
    };
  }
  return {
    email: process.env.INSTITUTIONAL_UNIVERSITY_STAFF_EMAIL,
    password: process.env.INSTITUTIONAL_UNIVERSITY_STAFF_PASSWORD,
  };
}

/**
 * ログイン画面の文章リンクから共有アカウントへログインする。
 * パスワードはサーバー専用環境変数からのみ読み、ブラウザへ返さない。
 */
export async function signInInstitutionalAccount(kind: string): Promise<InstitutionalLoginResult> {
  const locale = await getLocale();
  if (kind !== "service_desk" && kind !== "university_staff") {
    return { error: locale === "en" ? "Unknown account type." : "ログイン種別を確認できませんでした。" };
  }

  const credentials = credentialsFor(kind);
  if (!credentials.email || !credentials.password || !WASEDA_EMAIL_REGEX.test(credentials.email)) {
    return {
      error: locale === "en"
        ? "This institutional account has not been configured yet."
        : "この関係者アカウントはまだ設定されていません。管理者にお問い合わせください。",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error || !data.user) {
    return {
      error: locale === "en"
        ? "Institutional sign-in failed. Please contact an administrator."
        : "関係者アカウントでログインできませんでした。管理者にお問い合わせください。",
    };
  }

  // 環境変数の取り違えで通常寮生へ自動ログインしないよう、DB側の種別も照合する。
  const { data: profile } = await supabase
    .from("users")
    .select("account_kind")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.account_kind !== kind) {
    await supabase.auth.signOut();
    return {
      error: locale === "en"
        ? "The institutional account mapping is incomplete."
        : "関係者アカウントの紐付けが完了していません。管理者にお問い合わせください。",
    };
  }

  redirect("/");
}
