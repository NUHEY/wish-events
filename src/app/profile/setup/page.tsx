import { getCurrentProfile } from "@/lib/auth";
import { ProfileForm } from "@/components/auth/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfileSetupPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>プロフィール登録</CardTitle>
          <CardDescription>
            初回ログインのため、以下の情報を登録してください。登録後はイベント一覧画面に進みます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm role={profile.role} />
        </CardContent>
      </Card>
    </div>
  );
}
