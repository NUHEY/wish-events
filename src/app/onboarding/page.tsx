import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth";
import { getManagementAccess } from "@/lib/management-access";
import { getLocale } from "@/lib/i18n";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "使い方ガイド | WISH Events",
};

export default async function OnboardingPage() {
  const [profile, locale, access] = await Promise.all([getCurrentProfile(), getLocale(), getManagementAccess()]);

  return (
    <OnboardingFlow
      locale={locale}
      role={profile.role}
      canAccessManagement={access.isRa || access.permissions.length > 0}
      name={profile.full_name ?? ""}
    />
  );
}
