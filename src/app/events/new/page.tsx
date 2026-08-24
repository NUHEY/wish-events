import { requireRa } from "@/lib/auth";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale, getDictionary } from "@/lib/i18n";

export default async function NewEventPage() {
  await requireRa();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="mx-auto max-w-2xl">
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
