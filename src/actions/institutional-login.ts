"use server";

import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n";
import {
  institutionalAccountEmail,
  institutionalAvatarUrl,
  institutionalDisplayName,
  type InstitutionalAccountKind,
} from "@/lib/institutional-accounts";

export type { InstitutionalAccountKind } from "@/lib/institutional-accounts";
export type InstitutionalLoginResult =
  | { success: true; accessToken: string; refreshToken: string }
  | { success: false; error: string };

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function credentialsFor(kind: InstitutionalAccountKind) {
  const sharedPassword = process.env.INSTITUTIONAL_SHARED_PASSWORD;
  if (kind === "service_desk") {
    return {
      email: institutionalAccountEmail(kind),
      expectedPasswords: [process.env.INSTITUTIONAL_SERVICE_DESK_PASSWORD, sharedPassword].filter((value): value is string => !!value),
    };
  }
  return {
    email: institutionalAccountEmail(kind),
    expectedPasswords: [process.env.INSTITUTIONAL_UNIVERSITY_STAFF_PASSWORD, sharedPassword].filter((value): value is string => !!value),
  };
}

function passwordsMatch(input: string, expected: string) {
  const inputBytes = Buffer.from(input, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return inputBytes.length === expectedBytes.length && timingSafeEqual(inputBytes, expectedBytes);
}

/**
 * メールアドレスはVercelのサーバー専用環境変数から補完し、利用者は
 * パスワードだけを入力する。入力値をVercel設定と照合したうえで、service roleが
 * 利用できる場合はSupabase Auth側の専用ユーザーも同じ値へ自動修復してからログインする。
 */
export async function signInInstitutionalAccount(kind: string, password: string): Promise<InstitutionalLoginResult> {
  const locale = await getLocale();
  if (kind !== "service_desk" && kind !== "university_staff") {
    return { success: false, error: locale === "en" ? "Unknown account type." : "ログイン種別を確認できませんでした。" };
  }

  const accountKind = kind as InstitutionalAccountKind;
  const credentials = credentialsFor(accountKind);
  if (!credentials.email || credentials.expectedPasswords.length === 0 || !EMAIL_REGEX.test(credentials.email)) {
    return {
      success: false,
      error: locale === "en"
        ? "This institutional account has not been configured yet."
        : "この関係者アカウントはまだ設定されていません。管理者にお問い合わせください。",
    };
  }
  if (!password || password.length > 256 || !credentials.expectedPasswords.some((expected) => passwordsMatch(password, expected))) {
    return {
      success: false,
      error: locale === "en"
        ? "The password is incorrect."
        : "パスワードが正しくありません。",
    };
  }

  let authEmail = credentials.email;
  const displayName = institutionalDisplayName(accountKind);
  const avatarUrl = institutionalAvatarUrl(accountKind);
  const admin = createAdminClient();

  if (admin) {
    // 既にSQL Editorで紐付け済みなら、そのユーザーを最優先で再利用する。
    const { data: linkedProfile } = await admin
      .from("users")
      .select("id,email")
      .eq("account_kind", accountKind)
      .maybeSingle();

    let authUserId = linkedProfile?.id ?? null;
    if (linkedProfile?.email && EMAIL_REGEX.test(linkedProfile.email)) authEmail = linkedProfile.email;

    if (authUserId) {
      const { data: existing } = await admin.auth.admin.getUserById(authUserId);
      if (!existing.user) authUserId = null;
      if (existing.user?.email) authEmail = existing.user.email;
    }

    if (!authUserId) {
      const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = usersPage.users.find((user) => user.email?.toLowerCase() === authEmail.toLowerCase());
      authUserId = existing?.id ?? null;
    }

    if (authUserId) {
      const { data: updated, error: updateAuthError } = await admin.auth.admin.updateUserById(authUserId, {
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName, avatar_url: avatarUrl, account_kind: accountKind },
        app_metadata: { account_kind: accountKind },
      });
      if (updateAuthError || !updated.user) {
        console.error("Failed to repair institutional auth user", { kind: accountKind, message: updateAuthError?.message });
        return { success: false, error: locale === "en" ? "Could not prepare this account." : "関係者アカウントを準備できませんでした。" };
      }
      authUserId = updated.user.id;
    } else {
      const { data: created, error: createAuthError } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: displayName, avatar_url: avatarUrl, account_kind: accountKind },
        app_metadata: { account_kind: accountKind },
      });
      if (createAuthError || !created.user) {
        console.error("Failed to create institutional auth user", { kind: accountKind, message: createAuthError?.message });
        return { success: false, error: locale === "en" ? "Could not prepare this account." : "関係者アカウントを準備できませんでした。" };
      }
      authUserId = created.user.id;
    }

    const { error: profileError } = await admin.from("users").upsert({
      id: authUserId,
      email: authEmail,
      full_name: displayName,
      avatar_url: avatarUrl,
      account_kind: accountKind,
      role: "resident",
    }, { onConflict: "id" });
    if (profileError) {
      console.error("Failed to sync institutional profile with admin client", { kind: accountKind, code: profileError.code });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
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
  if (data.user.email?.toLowerCase() !== authEmail.toLowerCase()) {
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
  const { data: profile } = await supabase.from("users").select("id").eq("id", data.user.id).maybeSingle();
  if (profile) {
    const { error: updateError } = await supabase.from("users").update({ full_name: displayName, avatar_url: avatarUrl }).eq("id", data.user.id);
    if (updateError) console.error("Failed to sync institutional profile", { kind, code: updateError.code });
  } else {
    const { error: insertError } = await supabase.from("users").insert({ id: data.user.id, email: authEmail, full_name: displayName, avatar_url: avatarUrl });
    if (insertError) console.error("Failed to create institutional profile", { kind, code: insertError.code });
  }

  return {
    success: true,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}
