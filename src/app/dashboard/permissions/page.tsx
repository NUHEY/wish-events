import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { InstitutionalPermissionManager } from "@/components/dashboard/institutional-permission-manager";

export default async function PermissionsPage() {
  await requireRa();
  const en = (await getLocale()) === "en";
  const supabase = await createClient();
  const { data, error } = await supabase.from("institutional_permissions").select("account_kind, permissions, updated_at").order("account_kind");
  if (error || data?.length !== 2) throw new Error(en ? "Could not load permission settings. Please try again." : "権限設定を読み込めませんでした。もう一度お試しください。");
  return <div className="space-y-5"><header className="space-y-2"><h1 className="text-2xl font-bold">{en ? "Staff permissions" : "関係者の権限"}</h1><p className="text-sm leading-relaxed text-muted-foreground">{en ? "Select the functions each institutional account may use. Each selection allows viewing and the operations described below; it is not read-only access." : "関係者ごとに、担当する機能を選択します。許可すると閲覧に加え、下記に記載した投稿・編集などの操作も可能になります。"}</p></header><div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed"><p>{en ? "Only RAs can change permissions, appoint RAs or reset all room assignments. Selecting all keeps these actions RA-only." : "権限の変更・RAの任命・全寮生の一括退寮はRA専用です。「すべて許可」を選んでも、これらは関係者へ付与されません。"}</p><p className="mt-2 text-muted-foreground">{en ? "Event, broadcast, schedule and resident management involve resident records. Saved changes are checked on the next request; a page already open may remain visible until refreshed." : "イベント・通知・日程・寮生情報の管理では、寮生情報も扱います。保存後、次の画面表示・操作から新しい権限を確認します。開いている画面の表示は再読み込みまで残る場合があります。"}</p></div><InstitutionalPermissionManager settings={data} /></div>;
}
