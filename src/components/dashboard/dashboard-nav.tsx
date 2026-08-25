"use client";

import Link from "next/link";
import { Award, CalendarPlus, LayoutDashboard, MapPinHouse, Megaphone, Settings2, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard/new-event", icon: CalendarPlus, title: "新規イベント作成", desc: "イベントを追加" },
  { href: "/dashboard/new-announcement", icon: Megaphone, title: "お知らせ作成", desc: "お知らせを投稿" },
  { href: "/dashboard/ra-rooms", icon: MapPinHouse, title: "RA管理", desc: "RA個室・昇格降格" },
  { href: "/dashboard/residents", icon: Users, title: "寮生管理", desc: "住居情報の管理" },
  { href: "/dashboard/badges", icon: Award, title: "バッジ管理", desc: "マイページのバッジ" },
  { href: "/dashboard/home-layout", icon: LayoutDashboard, title: "ホーム画面編集", desc: "ホーム画面の構成" },
  { href: "/dashboard/event-options", icon: Settings2, title: "開催場所・対象者", desc: "会場・対象の選択肢" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="管理メニュー">{items.map((item) => { const active = pathname === item.href; return <Link key={item.href} href={item.href} prefetch className={cn("group flex min-h-24 flex-col gap-2 rounded-2xl border p-3 transition-all active:scale-[0.98]", active ? "border-primary/35 bg-primary/7 shadow-sm" : "border-border bg-card hover:border-primary/20 hover:bg-secondary/30")}><span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}><item.icon className="h-4 w-4" /></span><span><span className="block text-xs font-semibold leading-snug">{item.title}</span><span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{item.desc}</span></span></Link>; })}</nav>;
}
