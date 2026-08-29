"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Home, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import { signalNavigation } from "@/lib/navigation-signal";

function TabLink({
  href,
  icon: Icon,
  label,
  active,
  badge = false,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  badge?: boolean;
  onNavigate: (href: string, active: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(href, active)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-full flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors active:scale-[0.97] disabled:pointer-events-none",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="relative"><Icon className="h-5 w-5" />{badge && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />}</span>
      {label}
    </button>
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
  const pathname = usePathname();
  const router = useRouter();
  const isTalkRoom = pathname.startsWith("/talks/");
  // state更新を待たず同じフレーム内の連打も止めるため、共有refで3タブを排他制御する。
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = false;
  }, [pathname]);

  useEffect(() => {
    router.prefetch("/");
    router.prefetch("/events");
    router.prefetch("/talks");
  }, [router]);

  function navigate(href: string, active: boolean) {
    if (active || lockedRef.current) return;
    lockedRef.current = true;
    if (signalNavigation(href)) router.push(href);
    else lockedRef.current = false;
  }

  // 個別トークは入力欄まで含む全画面UIのため、下部タブを重ねない。
  // 戻る導線はトークヘッダー内に常時表示される。
  if (isTalkRoom) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 isolate border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md [transform:translateZ(0)] sm:hidden"
      aria-label={dict.nav.home}
    >
      <div className="flex h-[var(--mobile-tab-bar-height)] items-stretch">
        <TabLink href="/" icon={Home} label={dict.nav.home} active={pathname === "/"} onNavigate={navigate} />
        <TabLink href="/events" icon={CalendarDays} label={dict.nav.events} active={pathname.startsWith("/events")} onNavigate={navigate} />
        <TabLink href="/talks" icon={MessageCircle} label={dict.nav.talks} badge={hasUnreadTalk} active={pathname.startsWith("/talks")} onNavigate={navigate} />
      </div>
    </nav>
  );
}
