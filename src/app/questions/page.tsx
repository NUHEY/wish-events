import { redirect } from "next/navigation";
import { QuestionBox, type QuestionView } from "@/components/tools/question-box";
import { getCurrentProfile } from "@/lib/auth";
import { getFeatureFlagState } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";

export default async function QuestionsPage() {
  const profile = await getCurrentProfile();
  if ((await getFeatureFlagState("ra_question_box")) === "hidden" && profile.role !== "ra") redirect("/tools");
  const supabase = await createClient();
  const [{ data: rows }, { data: profiles }] = await Promise.all([supabase.from("ra_questions").select("*").order("created_at", { ascending: false }).limit(200), supabase.rpc("directory_profiles")]);
  const people = new Map(((profiles ?? []) as DirectoryProfileRow[]).map((person) => [person.id, person]));
  const questions = (rows ?? []).map((row) => ({ ...row, asked_name: people.get(row.asked_by)?.full_name, answered_name: row.answered_by ? people.get(row.answered_by)?.full_name : null })) as QuestionView[];
  return <QuestionBox questions={questions} currentUserId={profile.id} />;
}
