import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { WishKnowledgeBoard, type WishQuestionView } from "@/components/tools/wish-knowledge-board";

export default async function WisdomPage() {
  const profile = await getCurrentProfile();
  const state = await getFeatureFlagState("wish_knowledge");
  if (state === "hidden" && profile.role !== "ra") redirect("/tools");
  const supabase = await createClient();
  const { data: questions } = await supabase.from("wish_questions").select("*").order("created_at", { ascending: false }).limit(200);
  const ids = [...new Set((questions ?? []).map((question) => question.asked_by))];
  const { data: profiles } = ids.length ? await supabase.rpc("event_community_profiles_v3", { profile_ids: ids }) : { data: [] };
  const names = new Map((profiles ?? []).map((person: { id: string; full_name: string | null }) => [person.id, person.full_name]));
  const views = (questions ?? []).map((question) => ({ ...question, asker_name: names.get(question.asked_by) ?? null })) as WishQuestionView[];
  return <div className="mx-auto max-w-3xl"><WishKnowledgeBoard initialQuestions={views} currentName={profile.full_name} /></div>;
}
