"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/locale-provider";

export function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();
  const dict = useDict();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {dict.header.signOut}
    </Button>
  );
}
