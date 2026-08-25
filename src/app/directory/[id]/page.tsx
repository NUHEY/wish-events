import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale, getDictionary, findLabel, LANGUAGES, COUNTRIES } from "@/lib/i18n";
import { getLineQrSignedUrl } from "@/actions/line-qr";
import { formatRoomNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { BackButton } from "@/components/layout/back-button";
import type { DirectoryProfileRow } from "@/types/database";

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

  if (canViewFull) {
    const { data } = await supabase
      .from("users")
      .select(
        "id, full_name, role, floor_number, room_number, faculty, grade_level, languages, nationalities, lived_countries, instagram_handle, self_intro, line_qr_path, avatar_url"
      )
      .eq("id", id)
      .maybeSingle();
    if (data) {
      target = data;
      lineQrPath = data.line_qr_path;
    }
  } else {
    const { data } = await supabase.rpc("directory_profiles", { p_user_id: id });
    target = (data ?? [])[0] ?? null;
  }

  if (!target) notFound();

  const isSelf = viewer.id === target.id;
  const lineQrSignedUrl = lineQrPath ? await getLineQrSignedUrl(lineQrPath) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <BackButton fallbackHref="/directory" className="-ml-2" />

      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex items-center gap-3">
            {target.avatar_url ? (
              <Image
                src={target.avatar_url}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full object-cover shadow-sm"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-secondary text-xl font-semibold text-secondary-foreground shadow-sm">
                {target.full_name?.charAt(0) ?? "?"}
              </span>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{target.full_name ?? dict.common.notRegistered}</h1>
                {target.role === "ra" && <Badge variant="default">RA</Badge>}
                {isSelf && (
                  <span className="text-xs font-normal text-muted-foreground">({dict.raRooms.you})</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatRoomNumber(target.floor_number, target.room_number)}
              </p>
            </div>
          </div>

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

          {target.instagram_handle && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.instagramLabel}</p>
              <p className="text-sm">@{target.instagram_handle}</p>
            </div>
          )}

          {canViewFull && (
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">{dict.profile.lineLabel}</p>
              {lineQrSignedUrl ? (
                <div className="h-32 w-32 overflow-hidden rounded-md border border-border bg-muted">
                  <Image
                    src={lineQrSignedUrl}
                    alt="LINE QR"
                    width={128}
                    height={128}
                    className="h-full w-full object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{dict.profile.lineNotUploaded}</p>
              )}
            </div>
          )}

          {!canViewFull && (
            <p className="text-xs text-muted-foreground">{dict.directory.hiddenFieldsNote}</p>
          )}

          {isSelf && (
            <Link
              href="/profile/edit"
              className={buttonVariants({ variant: "outline", size: "sm", className: "w-fit" })}
            >
              {dict.directory.editYourProfile}
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
