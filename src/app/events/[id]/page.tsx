import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RegistrationButton } from "@/components/events/registration-button";
import { EventPoster } from "@/components/events/event-poster";
import { BackButton } from "@/components/layout/back-button";
import { formatEventDateTime } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";
import { deleteEvent } from "@/actions/events";
import type { EventCategory } from "@/types/database";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

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

  const isEn = locale === "en";
  const title = (isEn && event.title_en) || event.title;
  const description = (isEn && event.description_en) || event.description;
  const location = (isEn && event.location_en) || event.location;
  const audience = (isEn && event.target_audience_en) || event.target_audience;
  const categoryLabel = dict.categories[event.category as EventCategory] ?? event.category;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <BackButton fallbackHref="/events" className="-ml-2" />

      <EventPoster
        src={event.poster_url}
        alt={title}
        emptyLabel={dict.event.noImage}
        className="max-h-[70vh] rounded-lg"
        priority
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{categoryLabel}</Badge>
          {event.target_floors && event.target_floors.length > 0 && (
            <Badge variant="outline">
              {event.target_floors.map((f: number) => `${f}${dict.event.floorUnit}`).join("・")}
              {dict.event.limitedFloors}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <dl className="grid grid-cols-1 gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <div>
            <dt className="inline font-medium text-foreground">{dict.event.dateLabel}: </dt>
            <dd className="inline">{formatEventDateTime(event.event_date, locale)}</dd>
          </div>
          {location && (
            <div>
              <dt className="inline font-medium text-foreground">{dict.event.locationLabel}: </dt>
              <dd className="inline">{location}</dd>
            </div>
          )}
          {audience && (
            <div>
              <dt className="inline font-medium text-foreground">{dict.event.audienceLabel}: </dt>
              <dd className="inline">{audience}</dd>
            </div>
          )}
          {!!event.fee_amount && (
            <div>
              <dt className="inline font-medium text-foreground">{dict.event.feeLabel}: </dt>
              <dd className="inline">
                {dict.event.feePrefix}
                {event.fee_amount.toLocaleString()}
                {dict.event.feeUnit}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {event.payment_info && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <p className="mb-1 text-sm font-medium text-primary">{dict.event.paymentInfoTitle}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{event.payment_info}</p>
        </div>
      )}

      {description && (
        <div className="prose prose-sm max-w-none rounded-md border border-border p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
      )}

      {event.requires_registration && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-4">
          <p className="text-sm">
            {dict.event.registrationStatus}: <span className="font-semibold">{registeredCount}</span> /{" "}
            {event.capacity}
            {dict.event.peopleUnit}
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
          <p className="mb-2 text-sm font-medium">{dict.event.surveyTitle}</p>
          {event.survey_type === "external" ? (
            <a
              href={event.survey_external_url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {dict.event.surveyAnswer}
            </a>
          ) : (
            <Link
              href={`/events/${event.id}/survey`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {dict.event.surveyAnswer}
            </Link>
          )}
        </div>
      )}

      {profile.role === "ra" && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Link href={`/events/${event.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            {dict.event.editButton}
          </Link>
          <Link
            href={`/dashboard/${event.id}/participants`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {dict.event.participantsButton}
          </Link>
          <Link
            href={`/dashboard/${event.id}/survey`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {dict.event.surveyManageButton}
          </Link>
          <form
            action={async () => {
              "use server";
              await deleteEvent(event.id);
            }}
          >
            <Button type="submit" variant="destructive" size="sm">
              {dict.event.deleteButton}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
