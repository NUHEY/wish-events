import { createClient } from "@/lib/supabase/server";
import { PersonalSettings } from "@/components/settings/personal-settings";
export default async function SettingsPage() {
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 const {data:profile}=user?await supabase.from("users").select("account_kind").eq("id",user.id).maybeSingle():{data:null};
 return <PersonalSettings signedIn={!!user} resident={profile?.account_kind==="resident"}/>;
}
