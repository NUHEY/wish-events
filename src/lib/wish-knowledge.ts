import type { WishQuestionRow } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import type { WishQuestionView } from "@/components/tools/wish-knowledge-board";

/** Feed redacts anonymous authors at the database boundary. */
export async function getWishQuestions(): Promise<WishQuestionView[]> {
  const supabase = await createClient();
  const { data: questions, error } = await supabase.rpc("wish_question_feed", {}).returns<WishQuestionRow[]>().order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("質問を読み込めませんでした。再読み込みしてください。");
  const ids = [...new Set((questions ?? []).map(question => question.asked_by).filter((id): id is string => !!id))];
  const { data: profiles } = ids.length ? await supabase.rpc("event_community_profiles_v3", { profile_ids: ids }) : { data: [] };
  const names = new Map<string, string | null>((profiles ?? []).map((person: {id:string;full_name:string|null}) => [person.id, person.full_name]));
  return (questions ?? []).map(question => ({ ...question, asker_name: question.is_anonymous ? null : names.get(question.asked_by ?? "") ?? null }));
}
