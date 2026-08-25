import { requireRa } from "@/lib/auth";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackButton } from "@/components/layout/back-button";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewEventPage() {
  await requireRa();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <BackButton fallbackHref="/events" className="-ml-2" />
      <Card>
        <CardHeader>
          <CardTitle>{dict.eventForm.createTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm action={createEvent} submitLabel={dict.eventForm.createSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}
