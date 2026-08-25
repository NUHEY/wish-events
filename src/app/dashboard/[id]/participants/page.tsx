import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ParticipantTable } from "@/components/participants/participant-table";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function ParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  // event・questions・registrations はいずれも id のみで取得できるため並列取得する。
  const [{ data: event }, { data: questions }, { data: registrations }] = await Promise.all([
    supabase.from("events").select("id, title, title_en, fee_amount").eq("id", id).maybeSingle(),
    supabase.from("registration_questions").select("*").eq("event_id", id).order("position", { ascending: true }),
    supabase
      .from("registrations")
      .select(
        "id, user_id, registered_at, users(full_name, student_id, floor_number, room_number, email, faculty, grade_level), registration_answers(question_id, answer_text, answer_options), registration_payments(status)"
      )
      .eq("event_id", id)
      .order("registered_at", { ascending: true }),
  ]);
  if (!event) notFound();
  const title = (locale === "en" && event.title_en) || event.title;

  const participants = (registrations ?? []).map((r: any) => {
    const answers: Record<string, string> = {};
    for (const a of r.registration_answers ?? []) {
      answers[a.question_id] = a.answer_options?.length
        ? a.answer_options.join(", ")
        : a.answer_text ?? "";
    }
    return {
      user_id: r.user_id,
      registration_id: r.id,
      payment_status: r.registration_payments?.status ?? "unpaid",
      registered_at: r.registered_at,
      full_name: r.users?.full_name ?? null,
      student_id: r.users?.student_id ?? null,
      floor_number: r.users?.floor_number ?? null,
      room_number: r.users?.room_number ?? null,
      email: r.users?.email ?? null,
      faculty: r.users?.faculty ?? null,
      grade_level: r.users?.grade_level ?? null,
      answers,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <BackButton fallbackHref="/dashboard" className="-ml-2 self-start" />
      <h1 className="text-xl font-bold">
        {dict.participants.title}: {title}
      </h1>
      <ParticipantTable
        eventId={id}
        eventTitle={title}
        participants={participants}
        questions={questions ?? []}
        collectionRequired={!!event.fee_amount}
      />
    </div>
  );
}
