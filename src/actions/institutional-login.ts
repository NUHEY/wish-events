"use server";

import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import {
  institutionalAccountEmail,
  institutionalAvatarUrl,
  institutionalDisplayName,
  type InstitutionalAccountKind,
} from "@/lib/institutional-accounts";

export type { InstitutionalAccountKind } from "@/lib/institutional-accounts";
export type InstitutionalLoginResult =
  | { success: true }
  | { success: false; error: string };

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function credentialsFor(kind: InstitutionalAccountKind) {
  if (kind === "service_desk") {
    return {
      email: institutionalAccountEmail(kind),
      expectedPassword: process.env.INSTITUTIONAL_SERVICE_DESK_PASSWORD,
    };
  }
  return {
    email: institutionalAccountEmail(kind),
    expectedPassword: process.env.INSTITUTIONAL_UNIVERSITY_STAFF_PASSWORD,
  };
}

function passwordsMatch(input: string, expected: string) {
  const inputBytes = Buffer.from(input, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return inputBytes.length === expectedBytes.length && timingSafeEqual(inputBytes, expectedBytes);
}

/**
 * メールアドレスはVercelのサーバー専用環境変数から補完し、利用者は
 * パスワードだけを入力する。入力値をVercel設定と照合したうえで、同じ値を
 * Supabase Authにも渡すため、両方の設定が一致している場合だけログインできる。
 */
export async function signInInstitutionalAccount(kind: string, password: string): Promise<InstitutionalLoginResult> {
  const locale = await getLocale();
  if (kind !== "service_desk" && kind !== "university_staff") {
    return { success: false, error: locale === "en" ? "Unknown account type." : "ログイン種別を確認できませんでした。" };
  }

  const credentials = credentialsFor(kind);
  if (!credentials.email || !credentials.expectedPassword || !EMAIL_REGEX.test(credentials.email)) {
    return {
      success: false,
      error: locale === "en"
        ? "This institutional account has not been configured yet."
        : "この関係者アカウントはまだ設定されていません。管理者にお問い合わせください。",
    };
  }
  if (!password || password.length > 256 || !passwordsMatch(password, credentials.expectedPassword)) {
    return {
      success: false,
      error: locale === "en"
        ? "The password is incorrect."
        : "パスワードが正しくありません。",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password,
  });
  if (error || !data.user || !data.session) {
    return {
      success: false,
      error: locale === "en"
        ? "Institutional sign-in failed. Please contact an administrator."
        : "関係者アカウントでログインできませんでした。管理者にお問い合わせください。",
    };
  }

  // Supabaseから返った本人のメールも照合し、設定の取り違えを防ぐ。
  if (data.user.email?.toLowerCase() !== credentials.email.toLowerCase()) {
    await supabase.auth.signOut();
    return {
      success: false,
      error: locale === "en"
        ? "The institutional account configuration does not match."
        : "関係者アカウントの設定が一致していません。管理者にお問い合わせください。",
    };
  }

  // コメント等でも正式な名称と画像が表示されるよう、プロフィールを同期する。
  // ここに失敗しても認証済みセッションは有効なのでログイン自体は止めず、
  // 画面側のinstitutionalAccountKindForEmail()による表示補正をフォールバックにする。
  const displayName = institutionalDisplayName(kind);
  const avatarUrl = institutionalAvatarUrl(kind);
  const { data: profile } = await supabase.from("users").select("id").eq("id", data.user.id).maybeSingle();
  if (profile) {
    const { error: updateError } = await supabase.from("users").update({ full_name: displayName, avatar_url: avatarUrl }).eq("id", data.user.id);
    if (updateError) console.error("Failed to sync institutional profile", { kind, code: updateError.code });
  } else {
    const { error: insertError } = await supabase.from("users").insert({ id: data.user.id, email: credentials.email, full_name: displayName, avatar_url: avatarUrl });
    if (insertError) console.error("Failed to create institutional profile", { kind, code: insertError.code });
  }

  // createServerClient がServer ActionのレスポンスCookieへセッションを書き込む。
  // トークンをクライアントへ返さないことで、二重のsetSessionと遷移競合も避ける。
  return { success: true };
}
