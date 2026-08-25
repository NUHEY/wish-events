import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRow } from "@/types/database";

/**
 * ログイン中のユーザーの public.users 行を取得する。未ログインなら /login へ。
 *
 * 通常は auth.users への INSERT 時にDBトリガー(handle_new_auth_user)が
 * public.users のスタブ行を自動作成するが、
 *  - schema.sql 適用前にログインを試した
 *  - トリガーが何らかの理由で失敗した
 * などの場合、auth.users にはユーザーが存在するのに public.users には
 * 行が無い、という不整合が起こり得る。この状態で従来は /login に
 * リダイレクトしていたが、ログイン済みユーザーが /login に来ると
 * middleware側で再度 / に戻されるため「/ → /profile/setup → /login → /」
 * の無限リダイレクトループになってしまっていた。
 * そのため、行が存在しない場合はここでスタブ行を作成して復旧する。
 *
 * React cache()でラップしているのは、1回のページ表示（1リクエスト）の中で
 * 複数の箇所（ページ本体・friends.tsやevent-community.ts等の各サーバー
 * アクション）から独立にgetCurrentProfile()が呼ばれるケースが多く、
 * その都度auth.getUser()とusersテーブルへの問い合わせが重複発生していた
 * ため。寮生800人超が同時に使う無料枠のDB負荷を減らす目的で、同一
 * リクエスト内では最初の1回の結果を使い回すようにする（別リクエスト
 * （別ページ表示）ではキャッシュされず、常に最新の状態を取得する）。
 */
export const getCurrentProfile = cache(async (): Promise<UserRow> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) return profile;

  // スタブ行が無ければここで作成する（トリガーが効かなかった場合の保険）。
  // upsert ではなく plain insert を使う理由: role/email 列はRLSにより
  // authenticated からの UPDATE 権限が無いため、ON CONFLICT DO UPDATE が
  // 走ると権限エラーになり得る。トリガーとの競合（他リクエストが先に
  // 同じ行を作成済み）はユニーク制約違反として捕捉し、再取得すればよい。
  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({ id: user.id, email: user.email! })
    .select("*")
    .single();

  if (created) return created;

  // 競合で既に作成されていた場合はここで拾えるはず
  const { data: retried } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (retried) return retried;

  console.error("Failed to provision public.users row", insertError);
  redirect("/login");
});

/** RAでなければホームへリダイレクトする */
export async function requireRa(): Promise<UserRow> {
  const profile = await getCurrentProfile();
  if (profile.role !== "ra") redirect("/");
  return profile;
}

/**
 * ログイン直後・プロフィール登録直後の遷移先。
 * RAは管理ダッシュボードへ、一般寮生はイベント一覧へ。
 * RAも一寮生としてイベント一覧を見たり申し込んだりできるため、
 * ここで固定するのは「最初に見る画面」だけで、以降はヘッダーの
 * ナビゲーションでどちらの画面にも自由に行き来できる。
 */
export function postLoginPath(role: "resident" | "ra"): string {
  return role === "ra" ? "/dashboard" : "/";
}
