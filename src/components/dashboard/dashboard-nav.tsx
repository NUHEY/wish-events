"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Bell, CalendarDays, CalendarPlus, CalendarRange, ChevronRight, ClipboardList, House, LayoutDashboard, Link2, Megaphone, Menu, MessageCircleQuestion, Settings, ShieldCheck, SlidersHorizontal, UserRoundCog, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";
import { MANAGEMENT_GROUPS, MANAGEMENT_MODULES, canManage, type ManagementAccess, type ManagementPermission } from "@/lib/management-permissions";

const MODULE_ICONS: Record<ManagementPermission, typeof Menu> = {
  events: CalendarPlus,
  announcements: Megaphone,
  notifications: Bell,
  schedules: CalendarRange,
  questions: MessageCircleQuestion,
  links: Link2,
  badges: Award,
  residents: Users,
  home: House,
  event_options: ClipboardList,
  features: SlidersHorizontal,
  settings: Settings,
};

export function DashboardNav({ access }: { access: ManagementAccess }) {
  const pathname = usePathname();
  const en = useLocale() === "en";
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const modules = MANAGEMENT_MODULES.filter(module => canManage(access, module.key));
  const current = pathname === "/dashboard" ? (en ? "Overview" : "概要") : modules.find(module => module.href !== "/dashboard" && pathname.startsWith(module.href));
  const title = typeof current === "string" ? current : current ? (en ? current.en : current.ja) : (en ? "Management" : "管理ボード");
  useEffect(() => { if (open) dialog.current?.showModal(); else if (dialog.current?.open) dialog.current.close(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [open]);
  useEffect(() => { setOpen(false); }, [pathname]);
  function link(href: string, label: string, Icon: typeof Menu, overview = false) {
    const active = overview ? pathname === href : pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
    return <Link key={href + label} href={href} prefetch={false} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}><Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{label}</span><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60" /></Link>;
  }
  const groups = <div className="space-y-4">{link("/dashboard", en ? "Overview" : "概要", LayoutDashboard, true)}{MANAGEMENT_GROUPS.map(group => {
    const items = modules.filter(module => module.group === group.key);
    if (!items.length && !(group.key === "people" && access.isRa)) return null;
    return <section key={group.key}><h2 className="mb-1 px-3 text-xs font-bold text-muted-foreground">{en ? group.en : group.ja}</h2><div className="space-y-1">{items.flatMap(module => module.key === "events" ? [link("/events/new", en ? "Create event" : "イベント作成", CalendarPlus), link("/dashboard#managed-events", en ? "Event list" : "イベント一覧", CalendarDays)] : [link(module.href, en ? module.en : module.ja, MODULE_ICONS[module.key])])}{group.key === "people" && access.isRa && <>{link("/dashboard/permissions", en ? "Staff permissions" : "関係者の権限", ShieldCheck)}{link("/dashboard/ra-rooms", en ? "RA appointments" : "RAの任命・部屋", UserRoundCog)}</>}</div></section>;
  })}</div>;
  return <>
    <div className="md:hidden"><button ref={trigger} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"><Menu className="h-5 w-5 shrink-0 text-primary" /><span className="min-w-0 flex-1 break-words text-sm font-semibold">{title}</span><span className="shrink-0 text-xs text-muted-foreground">{en ? "Menu" : "メニュー"}</span></button></div>
    <aside className="hidden w-52 shrink-0 md:block"><nav aria-label={en ? "Management menu" : "管理メニュー"} className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3">{groups}</nav></aside>
    <dialog ref={dialog} onCancel={() => setOpen(false)} onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => { if (event.target === dialog.current) setOpen(false); }} aria-label={en ? "Management menu" : "管理メニュー"} className="m-0 h-dvh max-h-none w-[min(88vw,21rem)] max-w-none border-r border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40">
      <div className="flex h-full flex-col"><div className="flex items-center justify-between gap-2 border-b border-border p-3"><p className="px-2 font-bold">{en ? "Management menu" : "管理メニュー"}</p><button type="button" onClick={() => setOpen(false)} aria-label={en ? "Close menu" : "メニューを閉じる"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-secondary"><X className="h-5 w-5" /></button></div><nav className="flex-1 overflow-y-auto p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]" aria-label={en ? "Management functions" : "管理機能"}>{groups}</nav></div>
    </dialog>
  </>;
}
