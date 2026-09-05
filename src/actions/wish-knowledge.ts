"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import type { WishAnswerRow, WishQuestionRow } from "@/types/database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = ["life", "rules", "study", "food", "local", "other"] as const;

async function available() {
  const profile = await getCurrentProfile();
  const access = await getManagementAccess();
  return { profile, allowed: canManage(access, "questions") || (await getFeatureFlagState("wish_knowledge")) !== "hidden" };
}

export async function createWishQuestion(input: { title: string; body: string; category: string; visibility: "public" | "ra_only"; answer_scope: "everyone" | "ra_only" }): Promise<{ error?: string; question?: WishQuestionRow }> {
  const { profile, allowed } = await available();
  if (!allowed) return { error: "WISH知恵袋は現在公開されていません。" };
  if (!["public", "ra_only"].includes(input.visibility) || !["everyone", "ra_only"].includes(input.answer_scope)) return { error: "公開範囲を選択してください。" };
  const visibility = input.visibility;
  const answer_scope = visibility === "ra_only" ? "ra_only" : input.answer_scope;
  const title = input.title.trim();
  const body = input.body.trim();
  const category = CATEGORIES.includes(input.category as typeof CATEGORIES[number]) ? input.category as typeof CATEGORIES[number] : "other";
  if (!title || title.length > 120) return { error: "タイトルは1〜120文字で入力してください。" };
  if (!body || body.length > 2000) return { error: "質問内容は1〜2000文字で入力してください。" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("wish_questions").insert({ asked_by: profile.id, title, body, category, visibility, answer_scope }).select("*").single();
  if (error || !data) return { error: `質問を投稿できませんでした: ${error?.message ?? "不明なエラー"}` };
  revalidatePath("/wisdom");
  revalidatePath("/dashboard/questions");
  return { question: data };
}

export async function createWishAnswer(questionId: string, text: string): Promise<{ error?: string; answer?: WishAnswerRow }> {
  const { profile, allowed } = await available();
  if (!allowed) return { error: "WISH知恵袋は現在公開されていません。" };
  const body = text.trim();
  if (!UUID.test(questionId)) return { error: "質問が見つかりません。" };
  if (!body || body.length > 2000) return { error: "回答は1〜2000文字で入力してください。" };
  const supabase = await createClient();
  const { data: question, error: questionError } = await supabase.rpc("wish_question_feed", {}).eq("id", questionId).returns<WishQuestionRow[]>().maybeSingle();
  if (questionError || !question) return { error: "この質問を閲覧できません。" };
  if (question.answer_scope === "ra_only" && !(profile.role === "ra" && profile.account_kind === "resident")) return { error: "この質問にはRAのみ回答できます。" };
  const { data, error } = await supabase.from("wish_answers").insert({ question_id: questionId, answered_by: profile.id, body }).select("*").single();
  if (error || !data) return { error: `回答を投稿できませんでした: ${error?.message ?? "不明なエラー"}` };
  revalidatePath(`/wisdom/${questionId}`);
  revalidatePath("/wisdom");
  revalidatePath("/dashboard/questions");
  return { answer: data };
}

export async function acceptWishAnswer(questionId: string, answerId: string) {
  await getCurrentProfile();
  if (!UUID.test(questionId) || !UUID.test(answerId)) return { error: "回答が見つかりません。" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_wish_answer", { p_question_id: questionId, p_answer_id: answerId });
  if (error) return { error: error.message };
  revalidatePath(`/wisdom/${questionId}`);
  revalidatePath("/wisdom");
  revalidatePath("/dashboard/questions");
  return { success: true };
}

export async function deleteWishQuestion(questionId: string) {
  await getCurrentProfile();
  if (!UUID.test(questionId)) return { error: "質問が見つかりません。" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_wish_question", { p_question_id: questionId });
  if (error) return { error: `削除できませんでした: ${error.message}` };
  revalidatePath("/wisdom");
  revalidatePath("/dashboard/questions");
  return { success: true };
}
