"use server";

import { requireManagement } from "@/lib/management-access";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EventOptionActionResult = { error?: string; success?: boolean } | void;

/**
 * イベント作成フォームの「開催場所」「対象者」欄用の選択肢マスタ
 * (event_location_options / event_audience_options)をRAが管理するための
 * サーバーアクション。events側のlocation/target_audience列は自由記述の
 * ままなので、ここで追加した選択肢はdatalistの候補として提示されるのみ
 * （既存の自由記述との後方互換性を保つため）。
 */

type OptionKind = "location" | "audience";

function tableFor(kind: OptionKind) {
  return kind === "location" ? "event_location_options" : "event_audience_options";
}

async function addOption(
  kind: OptionKind,
  _prev: EventOptionActionResult,
  formData: FormData
): Promise<EventOptionActionResult> {
  await requireManagement("event_options");
  const supabase = await createClient();

  const labelJa = String(formData.get("label_ja") ?? "").trim();
  const labelEnRaw = String(formData.get("label_en") ?? "").trim();

  if (!labelJa) {
    return { error: "選択肢（日本語）を入力してください" };
  }

  const { count } = await supabase
    .from(tableFor(kind))
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from(tableFor(kind)).insert({
    label_ja: labelJa,
    label_en: labelEnRaw || null,
    position: count ?? 0,
  });

  if (error) {
    return { error: `追加に失敗しました: ${error.message}` };
  }

  revalidatePath("/dashboard/event-options");
  revalidatePath("/events/new");
  return { success: true };
}

async function removeOption(kind: OptionKind, id: string) {
  await requireManagement("event_options");
  const supabase = await createClient();
  const { error } = await supabase.from(tableFor(kind)).delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/event-options");
  revalidatePath("/events/new");
  return { success: true };
}

export async function addLocationOption(
  prev: EventOptionActionResult,
  formData: FormData
): Promise<EventOptionActionResult> {
  return addOption("location", prev, formData);
}

export async function addAudienceOption(
  prev: EventOptionActionResult,
  formData: FormData
): Promise<EventOptionActionResult> {
  return addOption("audience", prev, formData);
}

export async function removeLocationOption(id: string) {
  return removeOption("location", id);
}

export async function removeAudienceOption(id: string) {
  return removeOption("audience", id);
}
