import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * 関係者共有アカウントの初期作成・修復だけに使うサーバー専用クライアント。
 * service role keyは絶対にブラウザへ渡さず、未設定時は通常ログインへフォールバックする。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Supabaseの新しいsb_secret形式と、従来のservice_role形式をどちらも受け付ける。
  // 変数名を移行しても関係者ログインが止まらないよう、新しい名称を優先する。
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) return null;

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
