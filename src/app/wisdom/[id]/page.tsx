import type { WishQuestionRow } from "@/types/database";
import { notFound, redirect } from "next/navigation";
import { getManagementAccess } from "@/lib/management-access";
import { canManage } from "@/lib/management-permissions";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { WishQuestionDetail, type WishAnswerView } from "@/components/tools/wish-question-detail";

export default async function WishQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const state = await getFeatureFlagState("wish_knowledge");
  const access = await getManagementAccess();
  if (state === "hidden" && !canManage(access, "questions")) redirect("/tools");
  const supabase = await createClient();
  const [{ data: question, error: questionError }, { data: answers, error: answersError }] = await Promise.all([
    supabase.rpc("wish_question_feed", {}).eq("id", id).returns<WishQuestionRow[]>().maybeSingle(),
    supabase.from("wish_answers").select("*").eq("question_id", id).order("created_at", { ascending: true }),
  ]);
  if (questionError || answersError) throw new Error("質問・回答を読み込めませんでした。再読み込みしてください。");
  if (!question) notFound();
  const ids = [...new Set([question.asked_by, ...(answers ?? []).map((answer) => answer.answered_by)].filter((value): value is string => !!value))];
  const { data: profiles } = await supabase.rpc("event_community_profiles_v3", { profile_ids: ids });
  type Person = { id: string; full_name: string | null; avatar_url: string | null; role: "resident" | "ra" };
  const people = new Map(((profiles ?? []) as Person[]).map((person) => [person.id, person]));
  const asker = people.get(question.asked_by ?? "");
  const answerViews = (answers ?? []).map((answer) => { const person = people.get(answer.answered_by ?? ""); return { ...answer, answerer_name: person?.full_name ?? null, answerer_avatar: person?.avatar_url ?? null, answerer_role: person?.role ?? "resident" }; }) as WishAnswerView[];
  return <WishQuestionDetail question={{ ...question, asker_name: question.is_anonymous ? null : asker?.full_name ?? null, asker_avatar: question.is_anonymous ? null : asker?.avatar_url ?? null }} initialAnswers={answerViews} current={{ id: profile.id, name: profile.full_name, avatar: profile.avatar_url, role: access.isRa ? "ra" : "resident" }} canModerate={canManage(access, "questions")} />;
}
