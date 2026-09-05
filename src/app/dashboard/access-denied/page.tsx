import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { buttonVariants } from "@/components/ui/button";
export default async function AccessDeniedPage() {
  const en = (await getLocale()) === "en";
  return <div className="space-y-4 rounded-2xl border border-border bg-card p-5"><h1 className="text-xl font-bold">{en ? "This function is not available to your account" : "この機能は利用できません"}</h1><p className="text-sm text-muted-foreground">{en ? "Ask an RA to review your staff permissions." : "利用が必要な場合は、RAに関係者の権限設定を確認してもらってください。"}</p><Link className={buttonVariants({variant:"outline"})} href="/dashboard">{en ? "Back to management board" : "管理ボードへ戻る"}</Link></div>;
}
