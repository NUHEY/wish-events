"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

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
  return (
    <nav className="flex items-center gap-1">
      <NavLink href="/">イベント一覧</NavLink>
      {role === "ra" && (
        <>
          <NavLink href="/events/new">イベント作成</NavLink>
          <NavLink href="/dashboard">管理ダッシュボード</NavLink>
        </>
      )}
    </nav>
  );
}
