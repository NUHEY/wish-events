import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MANAGEMENT_KEYS, isInstitutionalKind, isManagementPermission, canManage, type ManagementPermission, type ManagementAccess } from "@/lib/management-permissions";

// React cache is request-scoped: revocation is checked again on every new action/request.
export const getManagementAccess = cache(async (): Promise<ManagementAccess> => {
  const profile = await getCurrentProfile();
  if (profile.role === "ra" && profile.account_kind === "resident") return { isRa: true, permissions: [...MANAGEMENT_KEYS] };
  if (!isInstitutionalKind(profile.account_kind)) return { isRa: false, permissions: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.from("institutional_permissions").select("permissions").eq("account_kind", profile.account_kind).maybeSingle();
  if (error) {
    console.error("Could not read management access", error.code);
    return { isRa: false, permissions: [] };
  }
  return { isRa: false, permissions: (data?.permissions ?? []).filter(isManagementPermission) };
});
export async function requireManagement(permission: ManagementPermission) {
  const access = await getManagementAccess();
  if (!canManage(access, permission)) redirect("/dashboard/access-denied");
  return getCurrentProfile();
}
export async function requireDashboard() {
  const access = await getManagementAccess();
  if (!access.isRa && !access.permissions.length) redirect("/");
  return access;
}
