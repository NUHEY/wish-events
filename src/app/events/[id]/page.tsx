import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RegistrationButton } from "@/components/events/registration-button";
import { formatEventDateTime } from "@/lib/utils";
import { deleteEvent } from "@/actions/events";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", id);

  const { data: myRegistration } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", id)
    .eq("user_id", profile.id)
    .maybeSingle();

  const registeredCount = count ?? 0;
  const isFull = event.capacity != null && registeredCount >= event.capacity;
  const isPast = new Date(event.event_date).getTime() < Date.now();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-muted">
        {event.poster_url ? (
          <Image src={event.poster_url} alt={event.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No Image</div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{event.category}</Badge>
          {event.target_floors && event.target_floors.length > 0 && (
            <Badge variant="outline">{event.target_floors.map((f: number) => `${f}階`).join("・")}限定</Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <dl className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline font-medium text-foreground">開催日時: </dt>
            <dd className="inline">{formatEventDateTime(event.event_date)}</dd>
          </div>
          {event.location && (
            <div>
              <dt className="inline font-medium text-foreground">開催場所: </dt>
              <dd className="inline">{event.location}</dd>
            </div>
          )}
          {event.target_audience && (
            <div>
              <dt className="inline font-medium text-foreground">対象者: </dt>
              <dd className="inline">{event.target_audience}</dd>
            </div>
          )}
        </dl>
      </div>

      {event.description && (
        <div className="prose prose-sm max-w-none rounded-md border border-border p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{event.description}</ReactMarkdown>
        </div>
      )}

      {event.requires_registration && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-4">
          <p className="text-sm">
            申込状況: <span className="font-semibold">{registeredCount}</span> / {event.capacity}名
          </p>
          {!isPast && (
            <RegistrationButton
              eventId={event.id}
              isRegistered={!!myRegistration}
              isFull={isFull}
            />
          )}
        </div>
      )}

      {isPast && event.survey_type !== "none" && (
        <div className="rounded-md border border-border p-4">
          <p className="mb-2 text-sm font-medium">イベント後アンケート</p>
          {event.survey_type === "external" ? (
            <a
              href={event.survey_external_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              アンケートに回答する
            </a>
          ) : (
            <Link
              href={`/events/${event.id}/survey`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              アンケートに回答する
            </Link>
          )}
        </div>
      )}

      {profile.role === "ra" && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Link href={`/events/${event.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            編集する
          </Link>
          <Link
            href={`/dashboard/${event.id}/participants`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            参加者一覧
          </Link>
          <Link
            href={`/dashboard/${event.id}/survey`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            アンケート管理
          </Link>
          <form
            action={async () => {
              "use server";
              await deleteEvent(event.id);
            }}
          >
            <Button type="submit" variant="destructive" size="sm">
              削除する
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
