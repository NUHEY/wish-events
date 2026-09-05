import { requireManagement } from "@/lib/management-access";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewEventPage() {
  await requireManagement("events");
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const [{ data: locationOptions }, { data: audienceOptions }, { data: teamMembers }] = await Promise.all([
    supabase.from("event_location_options").select("*").order("position", { ascending: true }),
    supabase.from("event_audience_options").select("*").order("position", { ascending: true }),
    supabase.from("users").select("id, full_name, avatar_url").eq("role", "ra").order("full_name"),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <BackButton fallbackHref="/events" className="-ml-2" />
      <Card>
        <CardHeader>
          <CardTitle>{dict.eventForm.createTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm
            action={createEvent}
            submitLabel={dict.eventForm.createSubmit}
            locationOptions={locationOptions ?? []}
            audienceOptions={audienceOptions ?? []}
            teamMembers={teamMembers ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
