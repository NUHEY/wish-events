import { getMoveOutProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MoveOutConfirm } from "@/components/move-out/move-out-confirm";
import { MoveOutCelebration } from "@/components/move-out/move-out-cards";
import { redirect } from "next/navigation";

export default async function MoveOutPage() {
  const profile = await getMoveOutProfile();
  if (profile.account_kind !== "resident") redirect("/");
  const supabase = await createClient();

  // This self-scoped RPC preserves the farewell card after community access ends.
  const { data: events, error } = await supabase.rpc("move_out_event_history");
  if (error) throw new Error("参加履歴を読み込めませんでした。もう一度お試しください。");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {profile.moved_out_at ? (
        <MoveOutCelebration fullName={profile.full_name} events={events ?? []} />
      ) : (
        <MoveOutConfirm fullName={profile.full_name} events={events ?? []} />
      )}
    </div>
  );
}
