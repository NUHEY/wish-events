import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";
import { updateEvent } from "@/actions/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  const [{ data: locationOptions }, { data: audienceOptions }] = await Promise.all([
    supabase.from("event_location_options").select("*").order("position", { ascending: true }),
    supabase.from("event_audience_options").select("*").order("position", { ascending: true }),
  ]);

  const updateWithId = updateEvent.bind(null, id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <BackButton fallbackHref={`/events/${id}`} className="-ml-2" />
      <Card>
        <CardHeader>
          <CardTitle>{dict.eventForm.editTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            action={updateWithId}
            initialEvent={event}
            submitLabel={dict.eventForm.editSubmit}
            locationOptions={locationOptions ?? []}
            audienceOptions={audienceOptions ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
