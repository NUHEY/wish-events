import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireRa } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRa();
  return <><div className="rounded-2xl border border-border bg-secondary/30 p-6 text-center sm:hidden"><h1 className="text-lg font-bold">管理機能はパソコンでご利用ください</h1><p className="mt-2 text-sm text-muted-foreground">画面の広いパソコンから操作してください。</p></div><div className="hidden flex-col gap-6 sm:flex"><div className="sticky top-[69px] z-[8] -mx-2 space-y-3 border-b border-border bg-background/95 px-2 pb-4 pt-1 backdrop-blur"><div><h1 className="text-2xl font-bold">管理ダッシュボード</h1><p className="text-sm text-muted-foreground">上のメニューは固定され、下の内容だけが切り替わります。</p></div><DashboardNav /></div><section className="min-h-[40vh]">{children}</section></div></>;
}
