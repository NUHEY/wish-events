import { getCurrentProfile } from "@/lib/auth";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getLineQrSignedUrl } from "@/actions/line-qr";
import { ProfileForm } from "@/components/auth/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfileEditPage() {
  const profile = await getCurrentProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const initialLineQrSignedUrl = profile.line_qr_path
    ? await getLineQrSignedUrl(profile.line_qr_path)
    : null;

  return (
    <div className="mx-auto max-w-md">
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
