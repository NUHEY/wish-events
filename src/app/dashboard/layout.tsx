import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireRa } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireRa();

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-xl font-bold tracking-tight sm:text-2xl">
            管理ダッシュボード
          </Link>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            左のメニューから管理機能を選ぶと、右側の内容が切り替わります。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary md:hidden">
          RA
        </span>
      </header>
      <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start md:gap-6">
        <DashboardNav />
        <section className="min-w-0 flex-1 md:min-h-[60vh]">{children}</section>
      </div>
    </div>
  );
}
