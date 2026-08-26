import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getDictionary } from "@/lib/i18n";
import { findLabel, LANGUAGES, COUNTRIES } from "@/lib/i18n/profile-options";
import { getLineQrSignedUrl } from "@/actions/line-qr";
import { buildAccentBackgroundGradient, cn, formatEventDateTime, formatRoomNumber } from "@/lib/utils";
import { AtSign, GraduationCap, Instagram, Languages as LanguagesIcon, MessageCircle, Sparkles, SquarePen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BackButton } from "@/components/layout/back-button";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
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

const CHIP_STYLES = [
  "border-rose-200/70 bg-rose-100/70 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/45 dark:text-rose-200",
  "border-sky-200/70 bg-sky-100/70 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/45 dark:text-sky-200",
  "border-emerald-200/70 bg-emerald-100/70 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/45 dark:text-emerald-200",
  "border-amber-200/70 bg-amber-100/70 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-200",
  "border-violet-200/70 bg-violet-100/70 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/45 dark:text-violet-200",
] as const;

function countryFlag(code: string) {
  const normalized = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "🌏";
  return String.fromCodePoint(...[...normalized].map((char) => 127397 + char.charCodeAt(0)));
}

function ChipList({ codes, list, locale, kind }: { codes: string[] | null; list: typeof LANGUAGES; locale: "ja" | "en"; kind: "language" | "country" }) {
  if (!codes || codes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {codes.map((code, index) => (
        <span key={code} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-sm", CHIP_STYLES[index % CHIP_STYLES.length])}>
          {kind === "country" ? <span aria-hidden>{countryFlag(code)}</span> : <LanguagesIcon className="h-3.5 w-3.5" />}
          {findLabel(list, code, locale)}
        </span>
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
            "id, full_name, role, floor_number, room_number, faculty, grade_level, languages, nationalities, lived_countries, instagram_handle, self_intro, line_qr_path, avatar_url, line_id, x_handle, profile_accents, profile_cover_url"
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
  const hasCoverBanner = Boolean(target.profile_cover_url || accentHexList.length > 0);

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
      <div className="flex items-center gap-2">
        <BackButton fallbackHref="/directory" className="-ml-2" />
        <div className="min-w-0">
          <h1 className="break-words text-xl font-bold tracking-tight [overflow-wrap:anywhere]">
            {isSelf ? "マイページ" : target.full_name ?? dict.common.notRegistered}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isSelf ? "プロフィールと活動を確認" : "寮生プロフィール"}
          </p>
        </div>
      </div>

      <Card
        className="overflow-hidden rounded-2xl"
        style={
          !target.profile_cover_url && accentBackgroundGradient
            ? { backgroundImage: accentBackgroundGradient }
            : undefined
        }
      >
        {/*
          カバー（背景）表示: 写真が設定されていればそれを幅いっぱいに広く表示し、
          未設定でもアクセントカラーが選ばれていればその帯を表示する。どちらも
          ない場合は何も表示しない（マイページ背景画像はご要望により未設定時は
          「画像なし」のままでよい仕様）。
          下に十分な余白(pb-8)を取り、アイコン・名前の行と重ならないようにする。
        */}
        {target.profile_cover_url ? (
          <div className="relative aspect-[3/1] w-full bg-secondary">
            <Image
              src={target.profile_cover_url}
              alt=""
              fill
              sizes="640px"
              className="object-cover"
              priority
            />
          </div>
        ) : (
          accentHexList.length > 0 && (
            <div
              className="h-16 w-full"
              style={{
                background:
                  accentHexList.length === 1
                    ? accentHexList[0]
                    : `linear-gradient(90deg, ${accentHexList.join(", ")})`,
              }}
            />
          )
        )}
        <CardContent className="flex flex-col gap-4 p-5">
          <div className={cn("flex items-end justify-between gap-3", hasCoverBanner && "-mt-10")}>
            <div className={cn("shrink-0 rounded-full", hasCoverBanner && "ring-[3px] ring-card")}>
              <AvatarRing role={target.role} eventCount={stats.event_count} size={64}>
                <Image
                  src={target.avatar_url || DEFAULT_AVATAR_IMAGE_URL}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              </AvatarRing>
            </div>
            {!isSelf && friendRelation && (
              <div className="flex shrink-0 items-center gap-2">
                {friendRelation.status === "friends" && (
                  <Link
                    href={`/talks/friends/${target.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
                    aria-label="メッセージ"
                    title="メッセージ"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                  </Link>
                )}
                <FriendButton targetId={target.id} initial={friendRelation} />
              </div>
            )}
          </div>

          <div className="-mt-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 break-words text-xl font-bold leading-tight [overflow-wrap:anywhere]">{target.full_name ?? dict.common.notRegistered}</h2>
              {target.role === "ra" && <Badge variant="default">RA</Badge>}
              {isSelf && <span className="text-xs font-normal text-muted-foreground">({dict.raRooms.you})</span>}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{roomText}</p>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border py-2.5 text-center">
            <div>
              <p className="text-lg font-bold">{stats.event_count}</p>
              <p className="text-[11px] text-muted-foreground">{dict.directory.statsEvents}</p>
            </div>
            <div>
              <p className="text-lg font-bold">{earnedBadges.length}</p>
              <p className="text-[11px] text-muted-foreground">{dict.directory.statsBadges}</p>
            </div>
            <div>
              <p className="text-lg font-bold">{stats.friend_count}</p>
              <p className="text-[11px] text-muted-foreground">{dict.directory.statsFriends}</p>
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

          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">{dict.profile.selfIntroLabel}</p>
            <p className="whitespace-pre-wrap text-sm">
              {target.self_intro || (
                <span className="text-muted-foreground">{dict.directory.noSelfIntro}</span>
              )}
            </p>
          </div>

          {(target.faculty || target.grade_level) && (
            <div className="flex flex-wrap gap-2 text-sm">
              {target.faculty && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-violet-200/70 bg-violet-100/70 px-3 py-2 font-semibold text-violet-900 shadow-sm dark:border-violet-900/60 dark:bg-violet-950/45 dark:text-violet-100">
                  <GraduationCap className="h-4 w-4" />
                  {dict.faculties[target.faculty as keyof typeof dict.faculties] ?? target.faculty}
                </span>
              )}
              {target.grade_level && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-100/70 px-3 py-2 font-semibold text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
                  <Sparkles className="h-4 w-4" />
                  {dict.gradeLevels[target.grade_level as keyof typeof dict.gradeLevels] ?? target.grade_level}
                </span>
              )}
            </div>
          )}

          {target.languages && target.languages.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.languagesLabel}</p>
              <ChipList codes={target.languages} list={LANGUAGES} locale={locale} kind="language" />
            </div>
          )}

          {target.nationalities && target.nationalities.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.nationalitiesLabel}</p>
              <ChipList codes={target.nationalities} list={COUNTRIES} locale={locale} kind="country" />
            </div>
          )}

          {target.lived_countries && target.lived_countries.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.livedCountriesLabel}</p>
              <ChipList codes={target.lived_countries} list={COUNTRIES} locale={locale} kind="country" />
            </div>
          )}

          {(target.instagram_handle || target.x_handle || target.line_id) && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {target.instagram_handle && (
                <a
                  href={`https://instagram.com/${target.instagram_handle}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`@${target.instagram_handle}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-gradient-to-r from-brand-instagram-start/15 via-brand-instagram-middle/15 to-brand-instagram-end/15 py-1.5 pl-1.5 pr-3 text-sm font-medium shadow-sm transition-transform active:scale-95"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-instagram-start via-brand-instagram-middle to-brand-instagram-end text-primary-foreground">
                    <Instagram className="h-3.5 w-3.5" />
                  </span>
                  <span className="max-w-[8rem] truncate">@{target.instagram_handle}</span>
                </a>
              )}
              {target.x_handle && (
                <a
                  href={`https://x.com/${target.x_handle}`}
                  target="_blank"
                  rel="noreferrer"
                  title={`@${target.x_handle}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 py-1.5 pl-1.5 pr-3 text-sm font-medium shadow-sm transition-transform active:scale-95"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <AtSign className="h-3.5 w-3.5" />
                  </span>
                  <span className="max-w-[8rem] truncate">@{target.x_handle}</span>
                </a>
              )}
              {target.line_id && (
                <span
                  title={`LINE ID: ${target.line_id}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-brand-line/10 py-1.5 pl-1.5 pr-3 text-sm font-medium shadow-sm"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-line text-primary-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                  </span>
                  <span className="max-w-[8rem] truncate">{target.line_id}</span>
                </span>
              )}
            </div>
          )}

          {canViewFull && (
            <div className="grid gap-1.5 border-t border-border pt-4">
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
                className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit gap-1.5" })}
              >
                <SquarePen className="h-3.5 w-3.5" />
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
                coverUrl: target.profile_cover_url,
                selfIntro: target.self_intro,
                faculty: target.faculty ? (dict.faculties[target.faculty as keyof typeof dict.faculties] ?? target.faculty) : null,
                gradeLevel: target.grade_level ? (dict.gradeLevels[target.grade_level as keyof typeof dict.gradeLevels] ?? target.grade_level) : null,
                languages: (target.languages ?? []).map((code) => findLabel(LANGUAGES, code, locale)),
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
