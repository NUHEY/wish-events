import type { UserAccountKind } from "@/types/database";

export type InstitutionalAccountKind = Exclude<UserAccountKind, "resident">;

const DISPLAY_NAMES: Record<InstitutionalAccountKind, string> = {
  service_desk: "２階生活窓口",
  university_staff: "早稲田大学学生生活課",
};

const AVATAR_URLS: Record<InstitutionalAccountKind, string> = {
  service_desk: "/images/institutional/service-desk.svg",
  university_staff: "/images/institutional/university-staff.svg",
};

const DEFAULT_AUTH_EMAILS: Record<InstitutionalAccountKind, string> = {
  service_desk: "service-desk@wish-events.local",
  university_staff: "university-staff@wish-events.local",
};

export function institutionalAccountEmail(kind: InstitutionalAccountKind) {
  const configured = kind === "service_desk"
    ? process.env.INSTITUTIONAL_SERVICE_DESK_EMAIL?.trim()
    : process.env.INSTITUTIONAL_UNIVERSITY_STAFF_EMAIL?.trim();
  return configured || DEFAULT_AUTH_EMAILS[kind];
}

export function institutionalDisplayName(kind: InstitutionalAccountKind) {
  return DISPLAY_NAMES[kind];
}

export function institutionalAvatarUrl(kind: InstitutionalAccountKind) {
  return AVATAR_URLS[kind];
}

/** Vercelに登録したメールと一致するユーザーだけを関係者アカウントとして扱う。 */
export function institutionalAccountKindForEmail(email: string | null | undefined): InstitutionalAccountKind | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === institutionalAccountEmail("service_desk")?.toLowerCase()) return "service_desk";
  if (normalized === institutionalAccountEmail("university_staff")?.toLowerCase()) return "university_staff";
  return null;
}
