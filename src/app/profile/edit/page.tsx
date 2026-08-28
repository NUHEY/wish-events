import { getCurrentProfile } from "@/lib/auth";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getLineQrSignedUrl } from "@/actions/line-qr";
import { ProfileForm } from "@/components/auth/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/layout/back-button";
import { redirect } from "next/navigation";

export default async function ProfileEditPage() {
  const profile = await getCurrentProfile();
  if (profile.account_kind !== "resident") redirect("/");
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const initialLineQrSignedUrl = profile.line_qr_path
    ? await getLineQrSignedUrl(profile.line_qr_path)
    : null;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3">
      <BackButton fallbackHref="/" className="-ml-2 self-start" />
      <Card>
        <CardHeader>
          <CardTitle>{dict.profile.editTitle}</CardTitle>
          <CardDescription>{dict.profile.editSubtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initialProfile={profile}
            initialLineQrSignedUrl={initialLineQrSignedUrl}
            submitLabel={dict.profile.submitEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
