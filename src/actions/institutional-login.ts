"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import {
  institutionalAccountEmail,
  institutionalDisplayName,
  type InstitutionalAccountKind,
} from "@/lib/institutional-accounts";

export type { InstitutionalAccountKind } from "@/lib/institutional-accounts";
export type InstitutionalLoginResult = { error?: string } | void;

const WASEDA_EMAIL_REGEX = /^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$/i;

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
    return { error: locale === "en" ? "Unknown account type." : "ログイン種別を確認できませんでした。" };
  }

  const credentials = credentialsFor(kind);
  if (!credentials.email || !credentials.expectedPassword || !WASEDA_EMAIL_REGEX.test(credentials.email)) {
    return {
      error: locale === "en"
        ? "This institutional account has not been configured yet."
        : "この関係者アカウントはまだ設定されていません。管理者にお問い合わせください。",
    };
  }
  if (!password || password.length > 256 || !passwordsMatch(password, credentials.expectedPassword)) {
    return {
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
  if (error || !data.user) {
    return {
      error: locale === "en"
        ? "Institutional sign-in failed. Please contact an administrator."
        : "関係者アカウントでログインできませんでした。管理者にお問い合わせください。",
    };
  }

  // Supabaseから返った本人のメールも照合し、設定の取り違えを防ぐ。
  if (data.user.email?.toLowerCase() !== credentials.email.toLowerCase()) {
    await supabase.auth.signOut();
    return {
      error: locale === "en"
        ? "The institutional account configuration does not match."
        : "関係者アカウントの設定が一致していません。管理者にお問い合わせください。",
    };
  }

  // コメント等でも正式名称が表示されるよう、本人に許可されたfull_name列だけ更新する。
  const displayName = institutionalDisplayName(kind);
  const { data: profile } = await supabase.from("users").select("id").eq("id", data.user.id).maybeSingle();
  if (profile) {
    await supabase.from("users").update({ full_name: displayName }).eq("id", data.user.id);
  } else {
    await supabase.from("users").insert({ id: data.user.id, email: credentials.email, full_name: displayName });
  }

  redirect("/");
}
