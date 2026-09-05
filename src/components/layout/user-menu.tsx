"use client";

import Link from "next/link";
import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { useRouter } from "next/navigation";
import { CircleHelp, DoorOpen, IdCard, LayoutDashboard, LogOut, Menu, Sparkles, UserRound, Users } from "lucide-react";
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
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { UserAccountKind, UserRole } from "@/types/database";

/**
 * ヘッダー右端のアバターボタン。以前は「プロフィール編集」リンク・RA用の
 * ダッシュボードアイコン・「ログアウト」ボタンが常時横並びで表示されていたが、
 * 頻度の低い操作が常に目に入り煩雑だったため、すべてこのドロップダウンに
 * まとめている。常時表示するのは日英切替とこのアバターのみ。
 */
export function UserMenu({
  userId,
  fullName,
  role,
  accountKind = "resident",
  floorNumber,
  roomNumber,
  avatarUrl,
  variant = "header",
  canAccessManagement = false,
}: {
  canAccessManagement?: boolean;
  userId: string;
  fullName: string | null;
  role: UserRole;
  accountKind?: UserAccountKind;
  floorNumber: number | null;
  roomNumber: string | null;
  avatarUrl: string | null;
  /** "header": デスクトップヘッダーのアバターボタン。"tab": モバイル下部タブバー用のコンパクトな縦積みボタン。 */
  variant?: "header" | "tab";
}) {
  const dict = useDict();
  const locale = useLocale();
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
              <Image src={avatarUrl} alt="" width={20} height={20} className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            {dict.nav.menu}
          </button>
        ) : (
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary text-sm font-semibold text-secondary-foreground shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={fullName ?? "menu"}
          >
            <Image src={avatarUrl || DEFAULT_AVATAR_IMAGE_URL} alt="" width={36} height={36} className="h-full w-full object-cover" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[15rem] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto">
        <Link href={`/directory/${userId}`} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent">
          <Image src={avatarUrl || DEFAULT_AVATAR_IMAGE_URL} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <span className="flex min-w-0 flex-col">
            <span className="break-words text-sm font-semibold leading-relaxed text-foreground">
              {fullName ?? dict.common.notRegistered}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {role === "ra" && <Badge variant="default">RA</Badge>}
              {accountKind !== "resident" && <Badge variant="secondary">{dict.common.institutionalAccount}</Badge>}
            </span>
            {accountKind === "resident" && <span className="text-xs text-muted-foreground">
              {formatRoomNumber(floorNumber, roomNumber)}
            </span>}
          </span>
        </Link>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <LocaleToggle />
          <ThemeToggle />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{locale === "ja" ? "プロフィール" : "Profile"}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/directory/${userId}`} className="cursor-pointer">
            <IdCard className="h-4 w-4" />
            {dict.header.viewMyPage}
          </Link>
        </DropdownMenuItem>
        {accountKind === "resident" && <DropdownMenuItem asChild>
          <Link href="/profile/edit" className="cursor-pointer"><UserRound className="h-4 w-4" />{dict.header.editProfile}</Link>
        </DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{locale === "ja" ? "寮生活・ヘルプ" : "Dorm life & help"}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/directory" className="cursor-pointer">
            <Users className="h-4 w-4" />
            {dict.nav.directory}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/tools" className="cursor-pointer">
            <Sparkles className="h-4 w-4" />
            {dict.nav.tools}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/onboarding" className="cursor-pointer">
            <CircleHelp className="h-4 w-4" />
            {locale === "en" ? "Quick guide" : "使い方ガイド"}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{locale === "ja" ? "アカウント・管理" : "Account & management"}</DropdownMenuLabel>
        {(role === "ra" || canAccessManagement) && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="cursor-pointer">
              <LayoutDashboard className="h-4 w-4" />
              {dict.nav.dashboard}
            </Link>
          </DropdownMenuItem>
        )}
        {accountKind === "resident" && <DropdownMenuItem asChild>
          <Link href="/move-out" className="cursor-pointer"><DoorOpen className="h-4 w-4" />{dict.moveOut.navMenuLabel}</Link>
        </DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {dict.header.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
