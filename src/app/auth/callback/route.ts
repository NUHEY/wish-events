import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { postLoginPath } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // "next" が明示的に指定されていれば最優先する（例: 特定イベントへの招待リンクなど）。
  // 指定が無ければ、RAは管理ダッシュボード、一般寮生はイベント一覧をデフォルトにする。
  const explicitNext = searchParams.get("next");

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
            .select("role, full_name, student_id, floor_number, room_number, wish_entry_month")
            .eq("id", user.id)
            .maybeSingle();

          // プロフィール未登録なら/profile/setupへ（middlewareでも二重にガードされる）
          const profileComplete =
            !!profile?.full_name &&
            !!profile?.student_id &&
            !!profile?.wish_entry_month &&
            profile?.floor_number != null &&
            !!profile?.room_number;

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
