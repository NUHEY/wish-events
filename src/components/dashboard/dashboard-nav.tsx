"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Beaker,
  CalendarPlus,
  Gauge,
  LayoutDashboard,
  MapPinHouse,
  Megaphone,
  MessageCircleQuestion,
  Menu,
  Send,
  Settings2,
  Share2,
  Link2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "概要",
    items: [{ href: "/dashboard", icon: Gauge, title: "ダッシュボード", desc: "イベント状況" }],
  },
  {
    label: "イベント・告知",
    items: [
      { href: "/dashboard/new-event", icon: CalendarPlus, title: "イベント作成", desc: "イベントを追加" },
      { href: "/dashboard/new-announcement", icon: Megaphone, title: "お知らせ作成", desc: "お知らせを投稿" },
      { href: "/dashboard/notifications", icon: Send, title: "通知を送信", desc: "対象を絞って配信" },
      { href: "/dashboard/event-options", icon: Settings2, title: "イベント設定", desc: "表示・会場・対象" },
    ],
  },
  {
    label: "コミュニティ",
    items: [
      { href: "/dashboard/home-layout", icon: LayoutDashboard, title: "ホーム編集", desc: "表示内容と並び順" },
      { href: "/dashboard/badges", icon: Award, title: "バッジ管理", desc: "獲得条件と表示" },
      { href: "/dashboard/questions", icon: MessageCircleQuestion, title: "RA質問箱", desc: "回答・Q&A公開" },
      { href: "/dashboard/link-hub", icon: Link2, title: "リンクページ", desc: "よく使うURLを共有" },
    ],
  },
  {
    label: "居住管理",
    items: [
      { href: "/dashboard/ra-rooms", icon: MapPinHouse, title: "RA管理", desc: "個室・昇格降格" },
      { href: "/dashboard/residents", icon: Users, title: "寮生管理", desc: "住居情報を管理" },
    ],
  },
  {
    label: "設定",
    items: [
      { href: "/dashboard/features", icon: Beaker, title: "機能の公開設定", desc: "ベータ機能" },
      { href: "/dashboard/settings", icon: Share2, title: "サイト設定", desc: "共有・操作・アニメーション" },
    ],
  },
] as const;

function isCurrentPath(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavGroups({ pathname, onNavigate, tabIndex }: { pathname: string; onNavigate?: () => void; tabIndex?: number }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isCurrentPath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  // 管理画面はそれぞれDB取得が多い。サイドバー表示だけで全画面を
                  // 同時取得しないよう、選ばれたページだけ読み込む。
                  prefetch={false}
                  onClick={onNavigate}
                  tabIndex={tabIndex}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-[background-color,color,transform] active:scale-[0.98]",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-primary-foreground/15" : "bg-secondary text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">{item.title}</span>
                    <span className={cn("mt-0.5 block truncate text-[11px]", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
                      {item.desc}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * 管理項目が増えても目的を見失わないよう、作成系・コミュニティ系・居住系・
 * 設定系に分類する。特に「機能の公開設定」と「共有・OGP設定」は、どちらも
 * サイト全体へ影響するため「設定」の配下にまとめた。PCでは常時見える左ナビ、
 * 狭い画面では本文幅を守るため同じ情報構造をドロワーで表示する。
 */
export function DashboardNav() {
  const pathname = usePathname();
  const drawerId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <div className="sticky top-[61px] z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls={drawerId}
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left shadow-sm active:scale-[0.99]"
        >
          <span className="flex items-center gap-2.5">
            <Menu className="h-5 w-5 text-primary" />
            <span>
              <span className="block text-sm font-bold">管理メニュー</span>
              <span className="block text-[11px] text-muted-foreground">目的の管理画面を選択</span>
            </span>
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">RA</span>
        </button>
      </div>

      <aside className="hidden w-64 shrink-0 md:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-card">
          <NavGroups pathname={pathname} />
        </div>
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-[70] md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="管理メニューを閉じる"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className={cn(
            "absolute inset-0 bg-foreground/35 backdrop-blur-sm transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0"
          )}
        />
        <nav
          id={drawerId}
          aria-label="管理メニュー"
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(88vw,21rem)] flex-col bg-card shadow-elevated transition-transform duration-200 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-bold">管理ダッシュボード</p>
              <p className="text-xs text-muted-foreground">RA用メニュー</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
              className="rounded-full p-2 text-muted-foreground active:bg-secondary"
              aria-label="管理メニューを閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <NavGroups pathname={pathname} onNavigate={() => setOpen(false)} tabIndex={open ? undefined : -1} />
          </div>
        </nav>
      </div>
    </>
  );
}
