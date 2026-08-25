"use client";

import Link from "next/link";
import { Award, Beaker, CalendarPlus, Gauge, LayoutDashboard, MapPinHouse, Megaphone, Settings2, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", icon: Gauge, title: "概要", desc: "イベント状況" },
  { href: "/dashboard/new-event", icon: CalendarPlus, title: "イベント作成", desc: "イベントを追加" },
  { href: "/dashboard/new-announcement", icon: Megaphone, title: "お知らせ作成", desc: "お知らせを投稿" },
  { href: "/dashboard/ra-rooms", icon: MapPinHouse, title: "RA管理", desc: "個室・昇格降格" },
  { href: "/dashboard/residents", icon: Users, title: "寮生管理", desc: "住居情報の管理" },
  { href: "/dashboard/badges", icon: Award, title: "バッジ管理", desc: "マイページのバッジ" },
  { href: "/dashboard/home-layout", icon: LayoutDashboard, title: "ホーム編集", desc: "ホーム画面の構成" },
  { href: "/dashboard/event-options", icon: Settings2, title: "会場・対象", desc: "選択肢の管理" },
  { href: "/dashboard/features", icon: Beaker, title: "公開設定", desc: "ベータ機能" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return <nav className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-9" aria-label="管理メニュー">{items.map((item) => { const active = pathname === item.href; return <Link key={item.href} href={item.href} prefetch className={cn("flex w-[88px] shrink-0 snap-start flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition-[border-color,background-color,transform] active:scale-[0.97] sm:min-h-24 sm:w-auto sm:items-start sm:gap-2 sm:rounded-2xl sm:p-3 sm:text-left", active ? "border-primary/35 bg-primary/[0.07] shadow-sm" : "border-border bg-card sm:hover:border-primary/20 sm:hover:bg-secondary/30")}><span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}><item.icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-[11px] font-semibold leading-tight sm:text-xs sm:leading-snug">{item.title}</span><span className="mt-0.5 hidden text-[10px] leading-snug text-muted-foreground sm:block">{item.desc}</span></span></Link>; })}</nav>;
}
