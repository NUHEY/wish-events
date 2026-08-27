import { QuestionManager } from "@/components/dashboard/question-manager";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryProfileRow } from "@/types/database";
import type { QuestionView } from "@/components/tools/question-box";

export default async function DashboardQuestionsPage() {
  await requireRa();
  const supabase = await createClient();
  const [{ data: rows }, { data: profiles }] = await Promise.all([supabase.from("ra_questions").select("*").order("answer", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false }).limit(500), supabase.rpc("directory_profiles")]);
  const people = new Map(((profiles ?? []) as DirectoryProfileRow[]).map((person) => [person.id, person]));
  const questions = (rows ?? []).map((row) => ({ ...row, asked_name: people.get(row.asked_by)?.full_name, room_number: people.get(row.asked_by)?.room_number })) as (QuestionView & { floor_number: number | null; room_number?: string | null })[];
  return <div className="mx-auto max-w-3xl space-y-4"><header><h1 className="text-2xl font-bold">RA質問箱</h1><p className="mt-1 text-sm text-muted-foreground">寮生から届いた質問に回答し、必要なものだけ全寮生向けQ&Aとして公開します。</p></header><QuestionManager questions={questions} /></div>;
}
