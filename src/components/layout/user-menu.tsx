"use client";

import Link from "next/link";
import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { useRouter } from "next/navigation";
import { Settings2, ChevronRight, LayoutDashboard, LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatRoomNumber } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { UserAccountKind, UserRole } from "@/types/database";

/** 頻繁に使うプロフィールへの入口と、設定・管理・ログアウトをまとめる。 */
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-sm font-semibold text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
            aria-label={fullName ?? "menu"}
          >
            <Image src={avatarUrl || DEFAULT_AVATAR_IMAGE_URL} alt="" width={32} height={32} className="h-8 w-8 rounded-full border border-border object-cover" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[15rem] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-6rem)] overflow-y-auto">
        <DropdownMenuItem asChild>
        <Link href={`/directory/${userId}`} aria-label={dict.header.viewMyPage} className="gap-2.5">
          <Image src={avatarUrl || DEFAULT_AVATAR_IMAGE_URL} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="break-words text-sm font-semibold leading-relaxed text-foreground">
              {fullName ?? dict.common.notRegistered}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              {role === "ra" && <Badge variant="default">RA</Badge>}
              {accountKind !== "resident" && <Badge variant="secondary">{dict.common.institutionalAccount}</Badge>}
              {accountKind === "resident" && <span className="whitespace-nowrap text-xs leading-5 text-muted-foreground">
                {formatRoomNumber(floorNumber, roomNumber)}
              </span>}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><Link href="/settings"><Settings2 className="h-4 w-4" />{locale === "en" ? "Your settings" : "自分の設定"}</Link></DropdownMenuItem>
        {(role === "ra" || canAccessManagement) && (
          <DropdownMenuItem asChild>
            <Link href="/dashboard" className="cursor-pointer">
              <LayoutDashboard className="h-4 w-4" />
              {dict.nav.dashboard}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleSignOut}>
          <LogOut className="h-4 w-4" />
          {dict.header.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
