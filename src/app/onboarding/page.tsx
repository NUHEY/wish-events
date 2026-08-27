import type { Metadata } from "next";
import { getCurrentProfile } from "@/lib/auth";
import { getLocale } from "@/lib/i18n";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "使い方ガイド | WISH Events",
};

export default async function OnboardingPage() {
  const [profile, locale] = await Promise.all([getCurrentProfile(), getLocale()]);

  return (
    <OnboardingFlow
      locale={locale}
      role={profile.role}
      name={profile.full_name ?? ""}
    />
  );
}
