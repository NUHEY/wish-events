"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import type { UserRole } from "@/types/database";

function NavLink({
  href,
  children,
  exact,
}: {
  href: string;
  children: React.ReactNode;
  /** trueの場合、この配下のサブパス（例: /dashboard/ra-rooms）ではアクティブ扱いにしない */
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/" || exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}

/**
 * RA向けの管理系リンク（イベント作成・管理ダッシュボード・RA管理・寮生管理）は
 * あえてこのグローバルナビには出さない。RAは代わりにヘッダーの小さいアイコン
 * （非RAには表示されない）から管理ダッシュボードに入り、そこから各管理画面へ
 * 遷移する。寮生ディレクトリは全ログインユーザー共通の機能なので常に表示する。
 */
export function Nav({ role: _role }: { role: UserRole }) {
  const dict = useDict();
  return (
    <nav className="flex items-center gap-1">
      <NavLink href="/">{dict.nav.events}</NavLink>
      <NavLink href="/directory">{dict.nav.directory}</NavLink>
    </nav>
  );
}
