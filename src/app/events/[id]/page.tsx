import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { CalendarDays, CircleDollarSign, MapPin, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RegistrationButton } from "@/components/events/registration-button";
import { FloatingRegistrationCta } from "@/components/events/floating-registration-cta";
import { EventPoster } from "@/components/events/event-poster";
import { EventShareButton } from "@/components/events/event-share-button";
import { EventComments } from "@/components/community/event-comments";
import { EventLikeButton } from "@/components/community/event-like-button";
import { BackButton } from "@/components/layout/back-button";
import { TeamAvatars } from "@/components/team/team-avatars";
import { formatEventDateTime } from "@/lib/utils";
import { getLocale, getDictionary } from "@/lib/i18n";
import { deleteEvent } from "@/actions/events";
import type { EventCategory, TeamMemberRow } from "@/types/database";

/** event_community_profiles_v3() の返り値（コメント投稿者の最小プロフィール）。 */
type CommunityProfile = { id: string; full_name: string | null; avatar_url: string | null; role: string };

function paymentStatusLabel(status: string | null | undefined) {
  if (status === "paid") return "支払い済み";
  if (status === "waived") return "免除";
  return "未払い";
}

/**
 * registration_payments(status) は1:1のFK関係だが、手書きの型定義には
 * Relationships情報がないためSupabaseの型推論が配列/オブジェクトのどちら
 * になるか環境依存になりやすい。実行時の実際の形に関わらず安全に読む。
 */
function readPaymentStatus(registrationPayments: unknown): string | null {
  const value = Array.isArray(registrationPayments) ? registrationPayments[0] : registrationPayments;
  return (value as { status?: string } | null | undefined)?.status ?? null;
}

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

  // このページはクエリが多いため、互いに依存しないものはPromise.allで並列
  // 実行し、往復のレイテンシが積み重ならないようにしている。
  const [
    { data: event },
    { data: registrationCountRaw },
    { data: myRegistration },
    { data: eventLikes },
    { data: registrationQuestions },
    { data: commentRows },
  ] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    // registrationsはRLSで本人+RA以外は直接SELECT/COUNTできないため、
    // 参加人数だけを安全に返すSECURITY DEFINER関数（event_registration_count）を使う。
    supabase.rpc("event_registration_count", { p_event_id: id }),
    supabase
      .from("registrations")
      .select("id, registration_payments(status)")
      .eq("event_id", id)
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase.from("event_likes").select("user_id").eq("event_id", id),
    supabase.from("registration_questions").select("*").eq("event_id", id).order("position", { ascending: true }),
    supabase.from("event_comments").select("*").eq("event_id", id).order("created_at", { ascending: false }),
  ]);
  if (!event) notFound();

  const commentIds = (commentRows ?? []).map((comment) => comment.id);
  const commentUserIds = [...new Set((commentRows ?? []).map((comment) => comment.user_id))];

  const [{ data: teamRows }, { data: commentUsers }, { data: likes }] = await Promise.all([
    event.member_ids?.length
      ? supabase.from("users").select("id, full_name, avatar_url").in("id", event.member_ids)
      : Promise.resolve({ data: [] as TeamMemberRow[] }),
    commentUserIds.length
      ? supabase.rpc("event_community_profiles_v3", { profile_ids: commentUserIds })
      : Promise.resolve({ data: null }),
    commentIds.length
      ? supabase.from("event_comment_likes").select("comment_id, user_id").in("comment_id", commentIds)
      : Promise.resolve({ data: [] }),
  ]);
  const commentUsersById = new Map(
    ((commentUsers ?? []) as CommunityProfile[]).map((user) => [user.id, user])
  );
  const comments = (commentRows ?? []).map((comment) => ({
    ...comment,
    user: commentUsersById.get(comment.user_id) ?? null,
    likeCount: (likes ?? []).filter((like) => like.comment_id === comment.id).length,
    likedByMe: (likes ?? []).some((like) => like.comment_id === comment.id && like.user_id === profile.id),
  }));

  const registeredCount = registrationCountRaw ?? 0;
  const isFull = event.capacity != null && registeredCount >= event.capacity;
  const isPast = new Date(event.event_date).getTime() < Date.now();
  const isUnpublished = !!event.publish_at && new Date(event.publish_at).getTime() > Date.now();

  // フローティング申込ボタン（本来の申込ボタンが画面外の間だけ画面下部に表示する
  // ショートカット）に出すラベルは、RegistrationButton内部の状態判定と揃える。
  const registrationOpen =
    !event.registration_opens_at || new Date(event.registration_opens_at).getTime() <= Date.now();
  const registrationClosed =
    !!event.registration_closes_at && new Date(event.registration_closes_at).getTime() < Date.now();
  const floatingCtaLabel = myRegistration
    ? dict.event.cancelRegistration
    : isFull
      ? dict.event.full
      : dict.event.register;
  const floatingCtaDisabled = !myRegistration && (!registrationOpen || registrationClosed || isFull);

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
          {profile.role === "ra" && isUnpublished && (
            <Badge variant="destructive">{dict.event.unpublishedBadge}</Badge>
          )}
          {event.is_pinned && (
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              {dict.event.pinnedBadge}
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <h1 className="text-2xl font-bold sm:pr-2">{title}</h1>
          <div className="flex items-center gap-1 self-end sm:shrink-0 sm:self-start"><EventShareButton eventId={event.id} title={title} categoryLabel={categoryLabel} eventDate={event.event_date} location={location} audience={audience} feeAmount={event.fee_amount} /><EventLikeButton eventId={event.id} count={(eventLikes ?? []).length} liked={(eventLikes ?? []).some((like) => like.user_id === profile.id)} /></div>
        </div>
        <dl className="grid grid-cols-1 gap-x-5 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><dd>{formatEventDateTime(event.event_date, locale)}</dd></div>
          {location && (
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><dd>
                {location}
                {event.location_url && (
                  <a
                    href={event.location_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1.5 text-primary underline-offset-2 hover:underline"
                  >
                    {dict.event.locationLinkText}
                  </a>
                )}
              </dd></div>
          )}
          {audience && (
            <div className="flex items-start gap-2"><UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><dd>{audience}</dd></div>
          )}
          {!!event.fee_amount && (
            <div className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><dd>
                {dict.event.feePrefix}
                {event.fee_amount.toLocaleString()}
                {dict.event.feeUnit}
              </dd></div>
          )}
          {event.contact_info && (
            <div>
              <dt className="inline font-medium text-foreground">{dict.event.contactInfoLabel}: </dt>
              <dd className="inline">{event.contact_info}</dd>
            </div>
          )}
        </dl>
        {(event.all_ra_members || (teamRows ?? []).length > 0) && <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground"><TeamAvatars members={teamRows ?? []} allRa={event.all_ra_members} /><span>企画</span></div>}
      </div>

      {event.payment_info && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <p className="mb-1 text-sm font-medium text-primary">{dict.event.paymentInfoTitle}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{event.payment_info}</p>
        </div>
      )}

      {!!event.fee_amount && !!myRegistration && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-primary">集金状況：{paymentStatusLabel(readPaymentStatus(myRegistration.registration_payments))}</p>
          {event.payment_due_at && <p className="mt-1 text-sm">集金期限：{formatEventDateTime(event.payment_due_at, locale)}</p>}
          {event.payment_destination && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">支払先：{event.payment_destination}</p>}
        </div>
      )}

      {event.notes && (
        <div className="rounded-md border border-border bg-secondary/30 p-4">
          <p className="mb-1 text-sm font-medium">{dict.event.notesTitle}</p>
          <p className="whitespace-pre-wrap text-sm text-foreground/90">{event.notes}</p>
        </div>
      )}

      {description && (
        <div className="prose prose-sm max-w-none rounded-md border border-border p-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{description}</ReactMarkdown>
        </div>
      )}

      <div id="registration-panel" className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            {event.capacity != null ? <>{dict.event.registrationStatus}: <span className="font-semibold text-foreground">{registeredCount}</span> / {event.capacity}{dict.event.peopleUnit}</> : <>参加受付中 · 定員なし</>}
          </p>
          {!isPast && (
            <RegistrationButton
              eventId={event.id}
              isRegistered={!!myRegistration}
              isFull={isFull}
              questions={registrationQuestions ?? []}
              registrationOpensAt={event.registration_opens_at}
              registrationClosesAt={event.registration_closes_at}
            />
          )}
          {!!myRegistration && <Link href={`/talks/${event.id}`} className="text-sm font-medium text-primary hover:underline">イベントのトークを見る</Link>}
        </div>
      {!isPast && (
        <FloatingRegistrationCta
          anchorId="registration-panel"
          label={floatingCtaLabel}
          disabled={floatingCtaDisabled}
        />
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

      <EventComments
        eventId={event.id}
        comments={comments}
        currentUserId={profile.id}
        isRa={profile.role === "ra"}
      />

      {profile.role === "ra" && (
        <div className="hidden flex-wrap gap-2 border-t border-border pt-4 sm:flex">
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
            href={`/events/${event.id}/questions`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {dict.event.questionsManageButton}
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
