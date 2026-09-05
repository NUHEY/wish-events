"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";

function TabLink({
  href,
  icon: Icon,
  label,
  active,
  badge = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full min-w-0 flex-1 whitespace-nowrap touch-manipulation flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-[0.97] disabled:pointer-events-none",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative"><Icon className="h-5 w-5" />{badge && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />}</span>
      {label}
    </Link>
  );
}

/**
 * モバイル幅（sm未満）専用の下部固定タブバー。ホーム/イベント一覧/トーク/便利ツールへ
 * 常に1タップで移動できるようにすることで、
 * ページ間の行き来の体感速度を上げる。sm以上ではヘッダーの通常ナビに戻るため
 * このバー自体を非表示にする。
 */
export function MobileTabBar({ hasUnreadTalk = false }: { hasUnreadTalk?: boolean }) {
  const dict = useDict();
  const pathname = usePathname();
  const isTalkRoom = pathname.startsWith("/talks/");

  // 個別トークは入力欄まで含む全画面UIのため、下部タブを重ねない。
  // 戻る導線はトークヘッダー内に常時表示される。
  if (isTalkRoom) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 isolate border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md [transform:translateZ(0)] sm:hidden"
      aria-label={dict.nav.home}
    >
      <div className="flex h-[var(--mobile-tab-bar-height)] items-stretch">
        <TabLink href="/" icon={Home} label={dict.nav.home} active={pathname === "/"} />
        <TabLink href="/events" icon={CalendarDays} label={dict.nav.events} active={pathname.startsWith("/events")} />
        <TabLink href="/talks" icon={MessageCircle} label={dict.nav.talks} badge={hasUnreadTalk} active={pathname.startsWith("/talks")} />
        <TabLink href="/tools" icon={Sparkles} label={dict.nav.tools} active={["/tools", "/questions", "/links", "/wisdom"].some((path) => pathname === path || pathname.startsWith(`${path}/`))} />
      </div>
    </nav>
  );
}
