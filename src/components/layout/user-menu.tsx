"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoorOpen, LayoutDashboard, LogOut, Menu, MessageCircle, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatRoomNumber } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import type { UserRole } from "@/types/database";

/**
 * ヘッダー右端のアバターボタン。以前は「プロフィール編集」リンク・RA用の
 * ダッシュボードアイコン・「ログアウト」ボタンが常時横並びで表示されていたが、
 * 頻度の低い操作が常に目に入り煩雑だったため、すべてこのドロップダウンに
 * まとめている。常時表示するのは日英切替とこのアバターのみ。
 */
export function UserMenu({
  fullName,
  role,
  floorNumber,
  roomNumber,
  avatarUrl,
  variant = "header",
}: {
  fullName: string | null;
  role: UserRole;
  floorNumber: number | null;
  roomNumber: string | null;
  avatarUrl: string | null;
  /** "header": デスクトップヘッダーのアバターボタン。"tab": モバイル下部タブバー用のコンパクトな縦積みボタン。 */
  variant?: "header" | "tab";
}) {
  const dict = useDict();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "tab" ? (
          <button
            type="button"
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label={fullName ?? "menu"}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            {dict.nav.menu}
          </button>
        ) : (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={fullName ?? "menu"}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              fullName?.charAt(0) ?? "?"
            )}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-2.5 py-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {fullName ?? dict.common.notRegistered}
            {role === "ra" && <Badge variant="default">RA</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRoomNumber(floorNumber, roomNumber)}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/talks" className="cursor-pointer">
            <MessageCircle className="h-4 w-4" />
            トーク
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/edit" className="cursor-pointer">
            <UserRound className="h-4 w-4" />
            {dict.header.editProfile}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/directory" className="cursor-pointer">
            <Users className="h-4 w-4" />
            {dict.nav.directory}
          </Link>
        </DropdownMenuItem>
        {role === "ra" && variant !== "tab" && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="cursor-pointer">
              <LayoutDashboard className="h-4 w-4" />
              {dict.nav.dashboard}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/move-out" className="cursor-pointer">
            <DoorOpen className="h-4 w-4" />
            {dict.moveOut.navMenuLabel}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {dict.header.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
