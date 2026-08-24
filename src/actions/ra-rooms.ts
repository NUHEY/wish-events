"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRa } from "@/lib/auth";

export type RaRoomActionResult = { error?: string; success?: boolean } | void;

const ROOM_FORMAT_REGEX = /^[0-9]{2}$/;

/** RA個室一覧に部屋番号を追加する。既にそこに住んでいる寮生がいれば即座にRAへ昇格する。 */
export async function addRaRoom(
  _prev: RaRoomActionResult,
  formData: FormData
): Promise<RaRoomActionResult> {
  const profile = await requireRa();
  const supabase = await createClient();

  const floorRaw = formData.get("floor_number");
  const roomRaw = formData.get("room_number");
  const note = formData.get("note");

  const floorNumber = Number(floorRaw);
  const roomNumber = String(roomRaw ?? "").trim();

  if (!Number.isInteger(floorNumber) || floorNumber < 3 || floorNumber > 11) {
    return { error: "階を選択してください" };
  }
  if (!ROOM_FORMAT_REGEX.test(roomNumber)) {
    return { error: "号室は数字2桁で入力してください（ユニット記号なし。例: 07）" };
  }

  const { error } = await supabase.from("ra_rooms").insert({
    floor_number: floorNumber,
    room_number: roomNumber,
    note: note ? String(note).trim() || null : null,
    created_by: profile.id,
  });

  if (error) {
    return {
      error:
        error.code === "23505"
          ? "その部屋番号は既に登録済みです"
          : `追加に失敗しました: ${error.message}`,
    };
  }

  // 既にこの部屋番号で登録している寮生がいれば即座にRAへ昇格させる
  await supabase.rpc("resync_room_role", { p_floor: floorNumber, p_room: roomNumber });

  revalidatePath("/dashboard/ra-rooms");
  return { success: true };
}

/** RA個室一覧から部屋番号を削除する。現在そこに住んでいてRAになっている寮生は即座にresidentへ降格する。 */
export async function removeRaRoom(
  id: string,
  floorNumber: number,
  roomNumber: string
) {
  await requireRa();
  const supabase = await createClient();

  const { error } = await supabase.from("ra_rooms").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }

  await supabase.rpc("resync_room_role", { p_floor: floorNumber, p_room: roomNumber });

  revalidatePath("/dashboard/ra-rooms");
  return { success: true };
}

/** RA一覧一覧に載っていない個別ユーザーを手動でresidentへ戻す（roster外の個別対応用） */
export async function demoteUserToResident(userId: string) {
  await requireRa();
  const supabase = await createClient();

  const { error } = await supabase.rpc("demote_to_resident", { p_user_id: userId });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/ra-rooms");
  return { success: true };
}
