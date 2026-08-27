"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";

function TabLink({
  href,
  icon: Icon,
  label,
  exact,
  badge = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
  badge?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      // 常設3タブはNext.js標準の部分先読みを使い、タップ後の待ち時間を短縮する。
      // 大量に並ぶイベントカード側は先読みを切ったままなので通信量は増幅しない。
      className={cn(
        "flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative"><Icon className="h-5 w-5" />{badge && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />}</span>
      {label}
    </Link>
  );
}

/**
 * モバイル幅（sm未満）専用の下部固定タブバー。ホーム/イベント一覧/トークへ
 * 常に1タップで移動できるようにすることで、
 * ページ間の行き来の体感速度を上げる。sm以上ではヘッダーの通常ナビに戻るため
 * このバー自体を非表示にする。
 */
export function MobileTabBar({ hasUnreadTalk = false }: { hasUnreadTalk?: boolean }) {
  const dict = useDict();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 isolate border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md [transform:translateZ(0)] sm:hidden"
      aria-label={dict.nav.home}
    >
      <div className="flex h-[var(--mobile-tab-bar-height)] items-stretch">
        <TabLink href="/" icon={Home} label={dict.nav.home} exact />
        <TabLink href="/events" icon={CalendarDays} label={dict.nav.events} />
        <TabLink href="/talks" icon={MessageCircle} label="トーク" badge={hasUnreadTalk} />
      </div>
    </nav>
  );
}
