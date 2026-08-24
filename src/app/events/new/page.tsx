import { requireRa } from "@/lib/auth";
import { EventForm } from "@/components/events/event-form";
import { createEvent } from "@/actions/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewEventPage() {
  await requireRa();

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>イベントを作成</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm action={createEvent} submitLabel="作成する" />
        </CardContent>
      </Card>
    </div>
  );
}
