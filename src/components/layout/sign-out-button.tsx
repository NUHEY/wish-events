"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  const dict = useDict();
  const locale = useLocale();
  const confirm = useConfirm();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        if (!(await confirm({
          message: locale === "en" ? "Are you sure you want to log out?" : "ログアウトしますか？",
          confirmLabel: dict.header.signOut,
        }))) return;
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {dict.header.signOut}
    </Button>
  );
}
