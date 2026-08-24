import { notFound } from "next/navigation";
import { requireRa } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/events/event-form";
import { updateEvent } from "@/actions/events";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRa();
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  const updateWithId = updateEvent.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>イベントを編集</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm action={updateWithId} initialEvent={event} submitLabel="更新する" />
        </CardContent>
      </Card>
    </div>
  );
}
