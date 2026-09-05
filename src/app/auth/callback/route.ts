import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postLoginPath } from "@/lib/auth";
import { institutionalAccountKindForEmail } from "@/lib/institutional-accounts";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // "next" が明示的に指定されていれば最優先する（例: 特定イベントへの招待リンクなど）。
  // 指定が無ければ、RAは管理ダッシュボード、一般寮生はイベント一覧をデフォルトにする。
  const requestedNext = searchParams.get("next");
  // Accept only local absolute paths. In particular, appending "@host" to the
  // origin would turn the trusted host into URL credentials and redirect away.
  const explicitNext = requestedNext
    && requestedNext.startsWith("/")
    && !requestedNext.startsWith("//")
    && !requestedNext.includes("\\")
    && !/[\u0000-\u001f\u007f]/.test(requestedNext)
    ? requestedNext
    : null;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let next = explicitNext ?? "/";

      if (!explicitNext) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("role, account_kind, full_name, student_id, floor_number, room_number, wish_entry_month")
            .eq("id", user.id)
            .maybeSingle();

          // プロフィール未登録なら/profile/setupへ（middlewareでも二重にガードされる）
          const profileComplete = institutionalAccountKindForEmail(user.email) !== null
            || (!!profile && profile.account_kind !== "resident") || (
            !!profile?.full_name &&
            !!profile?.student_id &&
            !!profile?.wish_entry_month &&
            profile?.floor_number != null &&
            !!profile?.room_number
          );

          if (profileComplete && profile) {
            next = postLoginPath(profile.role);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
