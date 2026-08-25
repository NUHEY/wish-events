import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const WASEDA_EMAIL_REGEX = /^[^@]+@([a-zA-Z0-9-]+\.)*waseda\.jp$/i;

const PUBLIC_PATHS = ["/login", "/auth/callback"];

/**
 * middleware.ts から呼ばれる中核ロジック。
 * - セッションのリフレッシュ
 * - waseda.jp ドメイン以外を弾く（DBトリガーに加えた二重チェック）
 * - 未ログイン → /login
 * - ログイン済みだがプロフィール未登録 → /profile/setup
 * - RA専用ページへの一般寮生アクセスを拒否
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some((p) => path.startsWith(p));

  /**
   * リダイレクト時は必ずこのヘルパーを経由すること。
   * getUser() の呼び出し中にセッションがリフレッシュされ、新しいCookieが
   * supabaseResponse に書き込まれている場合がある。素の
   * NextResponse.redirect() を直接returnするとそのCookieが失われ、
   * ブラウザが古い（失効済みの）トークンを送り続けて再度リダイレクトが
   * 発生し続ける＝無限リダイレクトループの典型的な原因になるため。
   */
  function redirectTo(pathname: string, params?: Record<string, string>) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  }

  // 未ログイン
  if (!user && !isPublicPath) {
    return redirectTo("/login");
  }

  if (user) {
    // ドメイン制限（多層防御。本来はDBトリガーで弾かれるが念のため）
    if (!WASEDA_EMAIL_REGEX.test(user.email ?? "")) {
      await supabase.auth.signOut();
      return redirectTo("/login", { error: "invalid_domain" });
    }

    // ログイン済みなのに /login や /auth/callback にいる場合はホームへ
    if (isPublicPath && path !== "/auth/callback") {
      return redirectTo("/");
    }

    if (!isPublicPath) {
      const { data: profile } = await supabase
        .from("users")
        .select("full_name, student_id, floor_number, room_number, role, moved_out_at")
        .eq("id", user.id)
        .maybeSingle();

      // 退寮設定済みのユーザーは、退寮ページ以外どこにアクセスしても
      // 退寮ページへ戻す（floor_number/room_numberがNULLになっているため
      // 通常のプロフィール未完了判定より先に判定する必要がある）。
      if (profile?.moved_out_at && path !== "/move-out") {
        return redirectTo("/move-out");
      }

      const profileComplete =
        !!profile?.full_name &&
        !!profile?.student_id &&
        profile?.floor_number != null &&
        !!profile?.room_number;

      if (!profile?.moved_out_at && !profileComplete && path !== "/profile/setup") {
        return redirectTo("/profile/setup");
      }

      if (profileComplete && path === "/profile/setup") {
        // RAは管理ダッシュボードへ、一般寮生はホームへ
        return redirectTo(profile?.role === "ra" ? "/dashboard" : "/");
      }

      const isRaOnlyPath =
        path.startsWith("/events/new") ||
        path.startsWith("/dashboard") ||
        path.startsWith("/announcements/new") ||
        /^\/events\/[^/]+\/edit/.test(path) ||
        /^\/announcements\/[^/]+\/edit/.test(path);

      if (isRaOnlyPath && profile?.role !== "ra") {
        return redirectTo("/");
      }
    }
  }

  return supabaseResponse;
}
