import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Server Components / Server Actions / Route Handlers 用のSupabaseクライアント。
 * 呼び出す場所によって Cookie の書き込み可否が異なるため try/catch で握りつぶす
 * （Server Component からの呼び出しでは Cookie を書き込めないため）。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component から呼ばれた場合は無視してよい
            // （middleware がセッションのリフレッシュを担当する）
          }
        },
      },
    }
  );
}
