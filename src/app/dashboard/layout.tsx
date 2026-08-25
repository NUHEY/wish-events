import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireRa } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRa();
  return <div className="flex flex-col gap-4 sm:gap-6"><div className="sticky top-[61px] z-[8] -mx-4 space-y-2.5 border-b border-border bg-background/95 px-4 pb-3 pt-1 backdrop-blur sm:top-[69px] sm:-mx-2 sm:space-y-3 sm:px-2 sm:pb-4"><div className="flex items-end justify-between gap-3"><div><Link href="/dashboard" className="text-lg font-bold tracking-tight sm:text-2xl">管理ダッシュボード</Link><p className="hidden text-sm text-muted-foreground sm:block">上のメニューは固定され、下の内容だけが切り替わります。</p></div><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary sm:hidden">RA</span></div><DashboardNav /></div><section className="min-h-[45vh]">{children}</section></div>;
}
