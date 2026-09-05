import { requireManagement } from "@/lib/management-access";
import { BroadcastNotificationForm, type BroadcastResident } from "@/components/dashboard/broadcast-notification-form";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardNotificationsPage() {
  await requireManagement("notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("users").select("id, full_name, role, floor_number, room_number").not("floor_number", "is", null).order("floor_number").order("room_number").limit(1000);
  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><div><h1 className="text-2xl font-bold">通知を送信</h1><p className="mt-1 text-sm text-muted-foreground">対象を確認してから、寮生の通知一覧へ短い案内を配信します。</p></div><BroadcastNotificationForm residents={(data as BroadcastResident[] | null) ?? []} /></div>;
}
