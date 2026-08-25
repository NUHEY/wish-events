import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getDictionary } from "@/lib/i18n";
import { findLabel, LANGUAGES, COUNTRIES } from "@/lib/i18n/profile-options";
import { getLineQrSignedUrl } from "@/actions/line-qr";
import { buildAccentBackgroundGradient, cn, formatEventDateTime, formatRoomNumber } from "@/lib/utils";
import { AtSign, ExternalLink, Instagram, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BackButton } from "@/components/layout/back-button";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { ProfileShareButton } from "@/components/profile/profile-share-card";
import { LineQrDisplay } from "@/components/profile/line-qr-display";
import { FriendButton } from "@/components/community/friend-button";
import { IncomingFriendRequests } from "@/components/community/incoming-friend-requests";
import { getFriendRelation, getIncomingFriendRequests } from "@/actions/friends";
import { PROFILE_ACCENT_HEX, type ProfileAccentKey } from "@/lib/constants";
import type { BadgeCriteriaType, BadgeRow, DirectoryProfileRow, EngagementStats } from "@/types/database";

/** バッジの条件種別ごとに、対応する集計値をEngagementStatsから取り出す。 */
function statForCriteria(stats: EngagementStats, criteriaType: BadgeCriteriaType): number {
  switch (criteriaType) {
    case "event_count":
      return stats.event_count;
    case "survey_count":
      return stats.survey_count;
    case "friend_count":
      return stats.friend_count ?? 0;
    case "comment_count":
      return stats.comment_count ?? 0;
    case "message_count":
      return stats.message_count ?? 0;
    case "like_given_count":
      return stats.like_given_count ?? 0;
    default:
      return 0;
  }
}

type PastEvent = { id: string; title: string; title_en: string | null; event_date: string; poster_url: string | null };

function ChipList({ codes, list, locale }: { codes: string[] | null; list: typeof LANGUAGES; locale: "ja" | "en" }) {
  if (!codes || codes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => (
        <Badge key={code} variant="secondary">
          {findLabel(list, code, locale)}
        </Badge>
      ))}
    </div>
  );
}

export default async function DirectoryProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const canViewFull = viewer.id === id || viewer.role === "ra";

  let target: DirectoryProfileRow | null = null;
  let lineQrPath: string | null = null;

  const [{ data: profileData }, { data: badges }, { data: statsData }] = await Promise.all([
    canViewFull
      ? supabase
          .from("users")
          .select(
            "id, full_name, role, floor_number, room_number, faculty, grade_level, languages, nationalities, lived_countries, instagram_handle, self_intro, line_qr_path, avatar_url, line_id, x_handle, profile_accents"
          )
          .eq("id", id)
          .maybeSingle()
      : supabase.rpc("directory_profiles", { p_user_id: id }).then((r) => ({ data: (r.data ?? [])[0] ?? null })),
    supabase.from("badges").select("*").order("sort_order", { ascending: true }),
    supabase.rpc("user_engagement_stats", { p_user_id: id }),
  ]);

  if (canViewFull) {
    target = profileData as DirectoryProfileRow | null;
    lineQrPath = (profileData as { line_qr_path?: string | null } | null)?.line_qr_path ?? null;
  } else {
    target = profileData as DirectoryProfileRow | null;
  }

  if (!target) notFound();

  const stats = ((statsData as EngagementStats[] | null) ?? [])[0] ?? {
    event_count: 0,
    survey_count: 0,
    friend_count: 0,
    comment_count: 0,
    message_count: 0,
    like_given_count: 0,
  };
  const earnedBadges = ((badges as BadgeRow[] | null) ?? [])
    .filter((b) => statForCriteria(stats, b.criteria_type) >= b.criteria_value)
    .map((b) => ({ icon: b.icon, label: locale === "en" && b.label_en ? b.label_en : b.label, description: locale === "en" && b.description_en ? b.description_en : b.description }));

  const isSelf = viewer.id === target.id;
  const [lineQrSignedUrl, friendRelation, incomingRequests] = await Promise.all([
    lineQrPath ? getLineQrSignedUrl(lineQrPath) : Promise.resolve(null),
    isSelf ? Promise.resolve(null) : getFriendRelation(target.id),
    isSelf ? getIncomingFriendRequests() : Promise.resolve([]),
  ]);
  const accentHexList = (target.profile_accents ?? [])
    .map((key) => PROFILE_ACCENT_HEX[key as ProfileAccentKey])
    .filter((hex): hex is string => Boolean(hex))
    .slice(0, 5);
  const accentHex = accentHexList[0] ?? null;
  const accentBackgroundGradient = buildAccentBackgroundGradient(accentHexList);

  let pastEvents: PastEvent[] = [];
  if (isSelf) {
    const { data: pastRegs } = await supabase
      .from("registrations")
      .select("event_id, events(id, title, title_en, event_date, poster_url)")
      .eq("user_id", target.id)
      .order("registered_at", { ascending: false })
      .limit(12)
      .returns<{ event_id: string; events: PastEvent | null }[]>();
    pastEvents = (pastRegs ?? []).map((r) => r.events).filter(Boolean) as PastEvent[];
  }

  const roomText = formatRoomNumber(target.floor_number, target.room_number);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <BackButton fallbackHref="/directory" className="-ml-2" />

      <Card
        className="overflow-hidden rounded-2xl"
        style={
          accentBackgroundGradient ? { backgroundImage: accentBackgroundGradient } : undefined
        }
      >
        {accentHexList.length > 0 && (
          <div
            className="h-16 w-full"
            style={{
              background:
                accentHexList.length === 1
                  ? accentHexList[0]
                  : `linear-gradient(90deg, ${accentHexList.join(", ")})`,
            }}
          />
        )}
        <CardContent className="flex flex-col gap-5 p-5">
          {/*
            カバー（アクセントカラー）の帯とアバターだけを重ねて見せたいので、
            マイナスマージンはこの行だけに限定する。以前はCardContent全体に
            掛けていたため、名前や部屋番号までカバーの上に乗り上げてしまっていた。
          */}
          <div className={`flex items-center gap-4 ${accentHex ? "-mt-10" : ""}`}>
            <div className={cn("shrink-0 rounded-full", accentHex && "ring-4 ring-card")}>
              <AvatarRing role={target.role} eventCount={stats.event_count} size={64}>
                {target.avatar_url ? (
                  <Image
                    src={target.avatar_url}
                    alt=""
                    width={64}
                    height={64}
                    className="h-16 w-16 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl font-semibold text-secondary-foreground">
                    {target.full_name?.charAt(0) ?? "?"}
                  </span>
                )}
              </AvatarRing>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold">{target.full_name ?? dict.common.notRegistered}</h1>
                {target.role === "ra" && <Badge variant="default">RA</Badge>}
                {isSelf && (
                  <span className="text-xs font-normal text-muted-foreground">({dict.raRooms.you})</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{roomText}</p>
            </div>
            {!isSelf && friendRelation && (
              <div className="flex shrink-0 items-center gap-2">
                {friendRelation.status === "friends" && (
                  <Link
                    href={`/talks/friends/${target.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    <MessageCircle className="mr-1 h-3.5 w-3.5" />
                    メッセージ
                  </Link>
                )}
                <FriendButton targetId={target.id} initial={friendRelation} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border py-2.5 text-center">
            <div>
              <p className="text-lg font-bold">{stats.event_count}</p>
              <p className="text-[11px] text-muted-foreground">{dict.directory.statsEvents}</p>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.friend_count}</p>
              <p className="text-[11px] text-muted-foreground">{dict.directory.statsFriends}</p>
            </div>
            <div>
              <p className="text-lg font-bold">{earnedBadges.length}</p>
              <p className="text-[11px] text-muted-foreground">{dict.directory.statsBadges}</p>
            </div>
          </div>

          {isSelf && <IncomingFriendRequests requests={incomingRequests} />}

          {earnedBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((b, i) => (
                <span
                  key={i}
                  title={b.description ?? b.label}
                  className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs font-medium"
                >
                  <span className="text-sm leading-none">{b.icon}</span>
                  {b.label}
                </span>
              ))}
            </div>
          )}

          {(target.faculty || target.grade_level) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {target.faculty && (
                <div>
                  <p className="text-xs text-muted-foreground">{dict.profile.facultyLabel}</p>
                  <p>{dict.faculties[target.faculty as keyof typeof dict.faculties] ?? target.faculty}</p>
                </div>
              )}
              {target.grade_level && (
                <div>
                  <p className="text-xs text-muted-foreground">{dict.profile.gradeLevelLabel}</p>
                  <p>{dict.gradeLevels[target.grade_level as keyof typeof dict.gradeLevels] ?? target.grade_level}</p>
                </div>
              )}
            </div>
          )}

          {target.languages && target.languages.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.languagesLabel}</p>
              <ChipList codes={target.languages} list={LANGUAGES} locale={locale} />
            </div>
          )}

          {target.nationalities && target.nationalities.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.nationalitiesLabel}</p>
              <ChipList codes={target.nationalities} list={COUNTRIES} locale={locale} />
            </div>
          )}

          {target.lived_countries && target.lived_countries.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.livedCountriesLabel}</p>
              <ChipList codes={target.lived_countries} list={COUNTRIES} locale={locale} />
            </div>
          )}

          <div className="grid gap-1.5 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">{dict.profile.selfIntroLabel}</p>
            <p className="whitespace-pre-wrap text-sm">
              {target.self_intro || (
                <span className="text-muted-foreground">{dict.directory.noSelfIntro}</span>
              )}
            </p>
          </div>

          {(target.instagram_handle || target.x_handle || target.line_id) && (
            <div className="grid gap-2.5 border-t border-border pt-4">
              {target.instagram_handle && (
                <a
                  href={`https://instagram.com/${target.instagram_handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-2 rounded-full border border-border bg-gradient-to-r from-[#FEDA75]/15 via-[#D62976]/15 to-[#4F5BD5]/15 py-1.5 pl-1.5 pr-3 text-sm font-medium shadow-sm transition-transform active:scale-95"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white">
                    <Instagram className="h-3.5 w-3.5" />
                  </span>
                  <span>@{target.instagram_handle}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                </a>
              )}
              {target.x_handle && (
                <a
                  href={`https://x.com/${target.x_handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm transition-colors hover:text-primary"
                >
                  <AtSign className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>@{target.x_handle}</span>
                </a>
              )}
              {target.line_id && (
                <div className="flex items-center gap-2 text-sm">
                  <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>{target.line_id}</span>
                  <span className="text-xs text-muted-foreground">（{dict.directory.lineIdHint}）</span>
                </div>
              )}
            </div>
          )}

          {canViewFull && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.lineLabel}</p>
              {lineQrSignedUrl ? (
                <LineQrDisplay src={lineQrSignedUrl} name={target.full_name} />
              ) : (
                <p className="text-sm text-muted-foreground">{dict.profile.lineNotUploaded}</p>
              )}
            </div>
          )}

          {!canViewFull && (
            <p className="text-xs text-muted-foreground">{dict.directory.hiddenFieldsNote}</p>
          )}

          {isSelf && pastEvents.length > 0 && (
            <div className="grid gap-2 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">{dict.directory.pastEventsTitle}</p>
              <div className="grid grid-cols-4 gap-2">
                {pastEvents.map((event) => (
                  <Link key={event.id} href={`/events/${event.id}`} className="group flex flex-col gap-1">
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
                      {event.poster_url ? (
                        <Image
                          src={event.poster_url}
                          alt=""
                          fill
                          sizes="120px"
                          className="object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                          {(locale === "en" && event.title_en) || event.title}
                        </div>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {formatEventDateTime(event.event_date, locale).split(" ")[0]}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {isSelf && (
              <Link
                href="/profile/edit"
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
              >
                {dict.directory.editYourProfile}
              </Link>
            )}
            <ProfileShareButton
              data={{
                fullName: target.full_name,
                roomText,
                avatarUrl: target.avatar_url,
                accentHex,
                badges: earnedBadges,
                eventCount: stats.event_count,
                surveyCount: stats.survey_count,
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
