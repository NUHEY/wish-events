import Link from "next/link";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { requireDashboard } from "@/lib/management-access";
import { getLocale } from "@/lib/i18n";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const access = await requireDashboard();
  const en = (await getLocale()) === "en";
  return <div className="flex flex-col gap-4"><header className="flex flex-wrap items-center justify-between gap-2"><Link href="/dashboard" className="text-xl font-bold tracking-tight sm:text-2xl">{en ? "Management board" : "管理ボード"}</Link><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{access.isRa ? "RA" : (en ? "Staff" : "関係者")}</span></header><div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start md:gap-6"><DashboardNav access={access} /><section className="min-w-0 flex-1 md:min-h-[60vh]">{children}</section></div></div>;
}
