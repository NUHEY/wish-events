import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * 関係者共有アカウントの初期作成・修復だけに使うサーバー専用クライアント。
 * service role keyは絶対にブラウザへ渡さず、未設定時は通常ログインへフォールバックする。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
