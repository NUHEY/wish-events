"use server";

import { revalidatePath } from "next/cache";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isInstitutionalKind, isManagementPermission } from "@/lib/management-permissions";
import { getLocale } from "@/lib/i18n";

export async function saveInstitutionalPermissions(kind: unknown, permissions: unknown, expectedUpdatedAt: string) {
  const profile = await requireRa();
  const en = (await getLocale()) === "en";
  if (profile.account_kind !== "resident" || !isInstitutionalKind(kind) || !Array.isArray(permissions) || !permissions.every(isManagementPermission) || typeof expectedUpdatedAt !== "string") {
    return { error: en ? "Check the selected permissions." : "権限の選択内容を確認してください。" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("institutional_permissions")
    .update({ permissions: [...new Set(permissions)], updated_by: profile.id, updated_at: new Date().toISOString() })
    .eq("account_kind", kind).eq("updated_at", expectedUpdatedAt).select("updated_at").maybeSingle();
  if (error) return { error: en ? "Could not save. Please try again." : "保存できませんでした。もう一度お試しください。" };
  if (!data) return { error: en ? "Another RA has updated these permissions. Reload this page before editing." : "別のRAが設定を更新しました。ページを再読み込みしてから変更してください。" };
  revalidatePath("/", "layout");
  return { success: true, updatedAt: data.updated_at };
}
