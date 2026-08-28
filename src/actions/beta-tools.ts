"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireRa } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { SCHEDULE_COPY, type ScheduleKind } from "@/lib/beta-tools";
import { getSiteSettings } from "@/lib/site-settings";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

async function featureAllowed(kind: ScheduleKind, role: "resident" | "ra") {
  if (role === "ra") return true;
  return (await getFeatureFlagState(SCHEDULE_COPY[kind].flag)) !== "hidden";
}

export type CreateScheduleInput = {
  kind: ScheduleKind;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  slotMinutes: 15 | 30 | 60;
  floorNumber?: number | null;
  participantIds: string[];
  raIds: string[];
};

export async function createScheduleSession(input: CreateScheduleInput) {
  const profile = await getCurrentProfile();
  if (!(input.kind in SCHEDULE_COPY) || !(await featureAllowed(input.kind, profile.role))) {
    return { error: "この機能は現在公開されていません。" };
  }
  if ((input.kind === "lets_chat" || input.kind === "urs") && profile.role !== "ra") {
    return { error: `${SCHEDULE_COPY[input.kind].shortTitle}の日程はRAが作成します。` };
  }

  const title = input.title.trim();
  const description = input.description?.trim() || null;
  if (!title || title.length > 80) return { error: "タイトルは1〜80文字で入力してください。" };
  if (description && description.length > 500) return { error: "説明は500文字以内で入力してください。" };
  if (!DATE_PATTERN.test(input.startDate) || !DATE_PATTERN.test(input.endDate)) return { error: "期間を正しく入力してください。" };
  const start = new Date(`${input.startDate}T00:00:00+09:00`);
  const end = new Date(`${input.endDate}T00:00:00+09:00`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const scheduleSettings = await getSiteSettings();
  if (!Number.isFinite(days) || days < 0 || days >= scheduleSettings.scheduleMaxDays) return { error: `期間は開始日から${scheduleSettings.scheduleMaxDays}日以内で設定してください。` };
  if (!TIME_PATTERN.test(input.dailyStartTime) || !TIME_PATTERN.test(input.dailyEndTime) || input.dailyStartTime >= input.dailyEndTime) {
    return { error: "1日の開始・終了時刻を正しく入力してください。" };
  }
  if (![15, 30, 60].includes(input.slotMinutes)) return { error: "時間枠が正しくありません。" };

  const participantIds = [...new Set([
    ...(input.kind === "general" ? [profile.id] : []),
    ...input.participantIds.filter((id) => UUID_PATTERN.test(id)),
  ])];
  const raIds = [...new Set(input.raIds.filter((id) => UUID_PATTERN.test(id)))];
  if (input.kind === "general" && participantIds.length < 2) return { error: "自分を含めて2人以上を選択してください。" };
  if (input.kind === "lets_chat" && raIds.length === 0) return { error: "予約を担当するRAを1人以上選択してください。" };
  if (input.kind === "urs" && raIds.length !== 1) return { error: "URSを担当するRAを1人選択してください。" };
  if (input.kind === "urs" && (participantIds.length < 2 || participantIds.length > 4)) return { error: "URSの寮生を2〜4人選択してください。" };
  const floorNumber = input.floorNumber == null ? profile.floor_number : Number(input.floorNumber);
  if (input.kind === "lets_chat" && (!floorNumber || floorNumber < 1 || floorNumber > 20)) return { error: "対象フロアを選択してください。" };

  const supabase = await createClient();
  const allIds = [...new Set([...participantIds, ...raIds])];
  if (allIds.length > 30) return { error: "参加者は30人以内で選択してください。" };
  const { data: validUsers, error: usersError } = await supabase.rpc("directory_profiles");
  if (usersError) return { error: "参加者を確認できませんでした。" };
  type ValidUser = { id: string; role: string; floor_number: number | null };
  const validById = new Map<string, ValidUser>(((validUsers ?? []) as ValidUser[]).map((user) => [user.id, user]));
  if (allIds.some((id) => !validById.has(id))) return { error: "選択した参加者を確認できませんでした。" };
  if (raIds.some((id) => validById.get(id)?.role !== "ra")) return { error: "RAではない寮生が担当RAに含まれています。" };
  if (input.kind === "lets_chat" && raIds.some((id) => validById.get(id)?.floor_number !== floorNumber)) {
    return { error: "Let's Chat!では対象フロアのRAを選択してください。" };
  }

  // セッションと参加者をDB内の1トランザクションで作成する。
  // 途中失敗時に「本体だけ残る」状態を防ぎ、画面側とRLS側のRA判定差もなくす。
  const { data: sessions, error } = await supabase.rpc("create_schedule_session", {
    p_kind: input.kind,
    p_title: title,
    p_description: description,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_daily_start_time: input.dailyStartTime,
    p_daily_end_time: input.dailyEndTime,
    p_slot_minutes: input.slotMinutes,
    p_floor_number: input.kind === "general" ? null : floorNumber,
    p_participant_ids: participantIds,
    p_ra_ids: raIds,
  });
  const session = sessions?.[0];
  if (error || !session) return { error: `日程を作成できませんでした: ${error?.message ?? "不明なエラー"}` };
  revalidatePath("/tools");
  return { success: true, token: session.share_token as string };
}

export async function saveScheduleAvailability(sessionId: string, slots: { startAt: string; endAt: string }[]) {
  await getCurrentProfile();
  if (!UUID_PATTERN.test(sessionId) || !Array.isArray(slots)) return { error: "空き時間の形式が正しくありません。" };
  const safeSlots = slots.slice(0, 1000).filter((slot) => !Number.isNaN(Date.parse(slot.startAt)) && !Number.isNaN(Date.parse(slot.endAt)));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_schedule_availability", { p_session_id: sessionId, p_slots: safeSlots });
  if (error) return { error: `保存できませんでした: ${error.message}` };
  revalidatePath("/tools/schedule/[token]", "page");
  return { success: true, count: Number(data ?? 0) };
}

export async function bookLetsChatSlot(sessionId: string, raId: string, startAt: string) {
  await getCurrentProfile();
  if (!UUID_PATTERN.test(sessionId) || !UUID_PATTERN.test(raId) || Number.isNaN(Date.parse(startAt))) return { error: "予約内容が正しくありません。" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("book_lets_chat_slot", { p_session_id: sessionId, p_ra_id: raId, p_start_at: startAt });
  if (error) return { error: error.message };
  revalidatePath("/tools/schedule/[token]", "page");
  return { success: true };
}

export async function setScheduleStatus(sessionId: string, status: "open" | "closed") {
  await requireRa();
  if (!UUID_PATTERN.test(sessionId) || !["open", "closed"].includes(status)) return { error: "日程の状態が正しくありません。" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_schedule_status", { p_session_id: sessionId, p_status: status });
  if (error) return { error: `状態を更新できませんでした: ${error.message}` };
  revalidatePath("/dashboard/schedules");
  revalidatePath("/tools/schedule/[token]", "page");
  return { success: true };
}

export async function deleteScheduleSession(sessionId: string) {
  await requireRa();
  if (!UUID_PATTERN.test(sessionId)) return { error: "日程IDが正しくありません。" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_schedule_session", { p_session_id: sessionId });
  if (error) return { error: `削除できませんでした: ${error.message}` };
  revalidatePath("/dashboard/schedules");
  revalidatePath("/tools");
  return { success: true };
}

export async function setLetsChatCompleted(bookingId: string, completed: boolean) {
  await requireRa();
  if (!UUID_PATTERN.test(bookingId)) return { error: "予約IDが正しくありません。" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lets_chat_completed", { p_booking_id: bookingId, p_completed: completed });
  if (error) return { error: `実施状況を更新できませんでした: ${error.message}` };
  revalidatePath("/tools/schedule/[token]", "page");
  revalidatePath("/dashboard/schedules");
  return { success: true };
}

export async function updateScheduleToolSettings(input: { startTime: string; endTime: string; slotMinutes: number; maxDays: number }) {
  const profile = await requireRa();
  if (!TIME_PATTERN.test(input.startTime) || !TIME_PATTERN.test(input.endTime) || input.startTime >= input.endTime) return { error: "標準の時間帯を正しく設定してください。" };
  if (![15, 30, 60].includes(input.slotMinutes)) return { error: "標準の時間枠を選択してください。" };
  const maxDays = Math.max(3, Math.min(31, Math.round(input.maxDays)));
  const supabase = await createClient();
  const { error } = await supabase.from("site_settings").update({ schedule_default_start_time: input.startTime, schedule_default_end_time: input.endTime, schedule_default_slot_minutes: input.slotMinutes, schedule_max_days: maxDays, updated_by: profile.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "日程ツールの設定を保存できませんでした。最新のSQLを適用してください。" };
  revalidatePath("/dashboard/schedules");
  revalidatePath("/tools/schedule/new");
  return { success: true };
}

export async function submitRaQuestion(questionText: string, anonymous: boolean) {
  const profile = await getCurrentProfile();
  if ((await getFeatureFlagState("ra_question_box")) === "hidden") return { error: "質問箱は現在公開されていません。" };
  const question = questionText.trim();
  if (!question || question.length > 500) return { error: "質問は1〜500文字で入力してください。" };
  const supabase = await createClient();
  const { error } = await supabase.from("ra_questions").insert({ asked_by: profile.id, floor_number: profile.floor_number, question, is_anonymous: anonymous });
  if (error) return { error: `質問を送れませんでした: ${error.message}` };
  revalidatePath("/questions");
  revalidatePath("/dashboard/questions");
  return { success: true };
}

export async function answerRaQuestion(questionId: string, answerText: string, publish: boolean) {
  const profile = await requireRa();
  if (!UUID_PATTERN.test(questionId)) return { error: "質問IDが正しくありません。" };
  const answer = answerText.trim();
  if (!answer || answer.length > 1200) return { error: "回答は1〜1200文字で入力してください。" };
  const supabase = await createClient();
  const { error } = await supabase.from("ra_questions").update({ answer, answered_by: profile.id, answered_at: new Date().toISOString(), is_public: publish, updated_at: new Date().toISOString() }).eq("id", questionId);
  if (error) return { error: `回答を保存できませんでした: ${error.message}` };
  revalidatePath("/questions");
  revalidatePath("/dashboard/questions");
  return { success: true };
}

export type LinkHubItemInput = { id?: string; title: string; url: string; description?: string; icon: "link" | "form" | "instagram" | "document" | "calendar" | "contact"; enabled: boolean };

export async function saveRaLinkHub(input: { slug: string; title: string; bio?: string; published: boolean; items: LinkHubItemInput[] }) {
  const profile = await requireRa();
  const slug = input.slug.trim().toLowerCase();
  const title = input.title.trim();
  const bio = input.bio?.trim() || null;
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) return { error: "共有URLは3〜40文字の半角英数字・ハイフンで入力してください。" };
  if (!title || title.length > 60 || (bio && bio.length > 240)) return { error: "タイトルまたは説明が長すぎます。" };
  const items = input.items.slice(0, 30).map((item, position) => ({ ...item, title: item.title.trim(), url: item.url.trim(), description: item.description?.trim() || null, position }));
  if (items.some((item) => !item.title || item.title.length > 60)) return { error: "各リンクのタイトルを1〜60文字で入力してください。" };
  if (items.some((item) => { try { const url = new URL(item.url); return !["http:", "https:"].includes(url.protocol); } catch { return true; } })) return { error: "URLは https:// または http:// から入力してください。" };

  const supabase = await createClient();
  const { data: hub, error } = await supabase.from("ra_link_hubs").upsert({ owner_id: profile.id, slug, title, bio, is_published: input.published, updated_at: new Date().toISOString() }, { onConflict: "owner_id" }).select("id, slug").single();
  if (error || !hub) return { error: error?.code === "23505" ? "この共有URLはすでに使われています。" : `ページを保存できませんでした: ${error?.message ?? "不明なエラー"}` };
  const { error: deleteError } = await supabase.from("ra_link_items").delete().eq("hub_id", hub.id);
  if (deleteError) return { error: `リンクを更新できませんでした: ${deleteError.message}` };
  if (items.length) {
    const { error: itemError } = await supabase.from("ra_link_items").insert(items.map((item) => ({ hub_id: hub.id, title: item.title, url: item.url, description: item.description, icon: item.icon, position: item.position, is_enabled: item.enabled })));
    if (itemError) return { error: `リンクを保存できませんでした: ${itemError.message}` };
  }
  revalidatePath("/dashboard/link-hub");
  revalidatePath("/links");
  revalidatePath(`/links/${slug}`);
  return { success: true, slug: hub.slug as string };
}
