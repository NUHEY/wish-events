import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RegistrationQuestionManager } from "@/components/events/registration-question-manager";
import { saveRegistrationQuestions } from "@/actions/registration-questions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function RegistrationQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const { data: event } = await supabase
    .from("events")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const { data: questions } = await supabase
    .from("registration_questions")
    .select("*")
    .eq("event_id", id)
    .order("position", { ascending: true });

  const saveWithEventId = saveRegistrationQuestions.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <BackButton fallbackHref={`/events/${id}`} className="-ml-2" />
      <h1 className="text-xl font-bold">
        {dict.registrationQuestions.manageTitle}: {event.title}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dict.registrationQuestions.manageTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistrationQuestionManager action={saveWithEventId} initialQuestions={questions ?? undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
