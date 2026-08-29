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
  | {
      success: false;
      error: string;
      code: "invalid_request" | "not_configured" | "invalid_password" | "admin_unavailable" | "account_prepare_failed" | "profile_sync_failed" | "sign_in_failed";
    };

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
    return { success: false, code: "invalid_request", error: locale === "en" ? "Unknown account type." : "ログイン種別を確認できませんでした。" };
  }

  const accountKind = kind as InstitutionalAccountKind;
  const credentials = credentialsFor(accountKind);
  if (!credentials.email || credentials.expectedPasswords.length === 0 || !EMAIL_REGEX.test(credentials.email)) {
    return {
      success: false,
      code: "not_configured",
      error: locale === "en"
        ? "This institutional account has not been configured yet."
        : "この関係者アカウントはまだ設定されていません。管理者にお問い合わせください。",
    };
  }
  if (!password || password.length > 256 || !credentials.expectedPasswords.some((expected) => passwordsMatch(password, expected))) {
    return {
      success: false,
      code: "invalid_password",
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
    const { data: linkedProfile, error: linkedProfileError } = await admin
      .from("users")
      .select("id,email")
      .eq("account_kind", accountKind)
      .maybeSingle();
    if (linkedProfileError) {
      console.error("Failed to find institutional profile", { kind: accountKind, code: linkedProfileError.code });
      return {
        success: false,
        code: "profile_sync_failed",
        error: locale === "en" ? "Could not prepare the institutional profile." : "関係者プロフィールを準備できませんでした。",
      };
    }

    let authUserId = linkedProfile?.id ?? null;
    let existingAppMetadata: Record<string, unknown> = {};
    let existingUserMetadata: Record<string, unknown> = {};
    if (linkedProfile?.email && EMAIL_REGEX.test(linkedProfile.email)) authEmail = linkedProfile.email;

    if (authUserId) {
      const { data: existing, error: getUserError } = await admin.auth.admin.getUserById(authUserId);
      if (getUserError) console.error("Failed to load linked institutional auth user", { kind: accountKind, message: getUserError.message });
      if (!existing.user) authUserId = null;
      if (existing.user) {
        if (existing.user.email) authEmail = existing.user.email;
        existingAppMetadata = existing.user.app_metadata ?? {};
        existingUserMetadata = existing.user.user_metadata ?? {};
      }
    }

    if (!authUserId) {
      // 800人を超える運用でも確実に既存アカウントを探せるようページングする。
      for (let page = 1; page <= 20 && !authUserId; page += 1) {
        const { data: usersPage, error: listUsersError } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (listUsersError) {
          console.error("Failed to list institutional auth users", { kind: accountKind, message: listUsersError.message });
          return {
            success: false,
            code: "account_prepare_failed",
            error: locale === "en" ? "Could not access the institutional account." : "関係者アカウントを確認できませんでした。",
          };
        }
        const existing = usersPage.users.find((user) => user.email?.toLowerCase() === authEmail.toLowerCase());
        if (existing) {
          authUserId = existing.id;
          existingAppMetadata = existing.app_metadata ?? {};
          existingUserMetadata = existing.user_metadata ?? {};
        }
        if (usersPage.users.length < 200) break;
      }
    }

    if (authUserId) {
      const { data: updated, error: updateAuthError } = await admin.auth.admin.updateUserById(authUserId, {
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { ...existingUserMetadata, full_name: displayName, avatar_url: avatarUrl, account_kind: accountKind },
        app_metadata: { ...existingAppMetadata, account_kind: accountKind },
      });
      if (updateAuthError || !updated.user) {
        console.error("Failed to repair institutional auth user", { kind: accountKind, message: updateAuthError?.message });
        return { success: false, code: "account_prepare_failed", error: locale === "en" ? "Could not prepare this account." : "関係者アカウントを準備できませんでした。" };
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
        return { success: false, code: "account_prepare_failed", error: locale === "en" ? "Could not prepare this account." : "関係者アカウントを準備できませんでした。" };
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
      return {
        success: false,
        code: "profile_sync_failed",
        error: locale === "en" ? "Could not save the institutional profile." : "関係者プロフィールを保存できませんでした。",
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (error || !data.user || !data.session) {
    console.error("Institutional password sign-in failed", { kind: accountKind, hasAdminClient: !!admin, message: error?.message });
    return {
      success: false,
      code: admin ? "sign_in_failed" : "admin_unavailable",
      error: locale === "en"
        ? admin
          ? "Institutional sign-in failed. Please try again."
          : "The server key required to prepare this account is missing."
        : admin
          ? "関係者アカウントでログインできませんでした。もう一度お試しください。"
          : "関係者アカウントの準備に必要なサーバー設定が見つかりません。",
    };
  }

  // Supabaseから返った本人のメールも照合し、設定の取り違えを防ぐ。
  if (data.user.email?.toLowerCase() !== authEmail.toLowerCase()) {
    await supabase.auth.signOut();
    return {
      success: false,
      code: "sign_in_failed",
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
