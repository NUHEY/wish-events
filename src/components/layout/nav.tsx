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

export function Nav({ role }: { role: UserRole }) {
  const dict = useDict();
  return (
    <nav className="flex items-center gap-1">
      <NavLink href="/">{dict.nav.events}</NavLink>
      {role === "ra" && (
        <>
          <NavLink href="/events/new">{dict.nav.newEvent}</NavLink>
          <NavLink href="/dashboard" exact>
            {dict.nav.dashboard}
          </NavLink>
          <NavLink href="/dashboard/ra-rooms">{dict.nav.raRooms}</NavLink>
          <NavLink href="/dashboard/residents">{dict.nav.residents}</NavLink>
        </>
      )}
    </nav>
  );
}
