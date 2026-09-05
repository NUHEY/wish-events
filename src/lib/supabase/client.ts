import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { boundedFetch } from "./bounded-fetch";

/** クライアントコンポーネント（ブラウザ）用のSupabaseクライアント */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: boundedFetch } }
  );
}
