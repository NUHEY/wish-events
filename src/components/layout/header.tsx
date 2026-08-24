import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/layout/nav";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { formatRoomNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getLocale, getDictionary } from "@/lib/i18n";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, floor_number, room_number")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-card/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              W
            </span>
            <span className="text-lg font-bold tracking-tight">WISH Events</span>
          </Link>
          <Nav role={profile.role} />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <LocaleToggle />
          {profile.role === "ra" && <Badge variant="default">RA</Badge>}
          {profile.role === "ra" && (
            // RA用の管理画面への入り口。あえてラベルを付けず、目立たない
            // アイコンボタンとしてのみ表示する（residentには最初からこの
            // ブロック自体が描画されない）。
            <Link
              href="/dashboard"
              title={dict.nav.dashboard}
              aria-label={dict.nav.dashboard}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
            >
              <LayoutDashboard className="h-4 w-4" />
            </Link>
          )}
          <Link
            href="/profile/edit"
            className="hidden items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent sm:flex"
            title={dict.header.editProfile}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {profile.full_name?.charAt(0) ?? "?"}
            </span>
            <span className="text-muted-foreground">
              {profile.full_name}
              <span className="text-xs">
                {" "}
                ({formatRoomNumber(profile.floor_number, profile.room_number)})
              </span>
            </span>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
