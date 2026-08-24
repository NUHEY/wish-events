"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { LineQrUploader } from "@/components/profile/line-qr-uploader";
import { FACULTIES, GRADE_LEVELS, FLOORS } from "@/lib/constants";
import { LANGUAGES, COUNTRIES } from "@/lib/i18n/locales";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { submitProfile } from "@/actions/profile";
import type { UserRow } from "@/types/database";

type InitialProfile = Pick<
  UserRow,
  | "full_name"
  | "student_id"
  | "floor_number"
  | "room_number"
  | "faculty"
  | "grade_level"
  | "languages"
  | "nationalities"
  | "lived_countries"
  | "instagram_handle"
  | "line_qr_path"
  | "self_intro"
>;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function ProfileForm({
  initialProfile,
  initialLineQrSignedUrl = null,
  submitLabel,
}: {
  initialProfile?: InitialProfile;
  initialLineQrSignedUrl?: string | null;
  submitLabel?: string;
}) {
  const dict = useDict();
  const locale = useLocale();
  const [state, formAction] = useFormState(submitProfile, undefined);

  const languageOptions = LANGUAGES.map((l) => ({ code: l.code, label: l[locale] }));
  const countryOptions = COUNTRIES.map((c) => ({ code: c.code, label: c[locale] }));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="full_name">{dict.profile.fullNameLabel}</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          placeholder={dict.profile.fullNamePlaceholder}
          defaultValue={initialProfile?.full_name ?? ""}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="student_id">{dict.profile.studentIdLabel}</Label>
        <Input
          id="student_id"
          name="student_id"
          required
          maxLength={8}
          placeholder={dict.profile.studentIdPlaceholder}
          defaultValue={initialProfile?.student_id ?? ""}
        />
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="floor_number">{dict.profile.floorLabel}</Label>
          <Select
            id="floor_number"
            name="floor_number"
            required
            defaultValue={initialProfile?.floor_number ?? ""}
            className="w-24"
          >
            <option value="" disabled>
              {dict.profile.floorPlaceholder}
            </option>
            {FLOORS.map((f) => (
              <option key={f} value={f}>
                {f}
                {dict.event.floorUnit}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="room_number">{dict.profile.roomNumberLabel}</Label>
          <Input
            id="room_number"
            name="room_number"
            required
            maxLength={3}
            placeholder={dict.profile.roomNumberPlaceholder}
            defaultValue={initialProfile?.room_number ?? ""}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{dict.profile.roomNumberHint}</p>

      <div className="grid gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">{dict.profile.extraSectionTitle}</p>
          <p className="text-xs text-muted-foreground">{dict.profile.extraSectionHint}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="faculty">{dict.profile.facultyLabel}</Label>
          <Select id="faculty" name="faculty" defaultValue={initialProfile?.faculty ?? ""}>
            <option value="">{dict.common.notSelected}</option>
            {FACULTIES.map((f) => (
              <option key={f} value={f}>
                {dict.faculties[f]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="grade_level">{dict.profile.gradeLevelLabel}</Label>
          <Select id="grade_level" name="grade_level" defaultValue={initialProfile?.grade_level ?? ""}>
            <option value="">{dict.common.notSelected}</option>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                {dict.gradeLevels[g]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="languages">{dict.profile.languagesLabel}</Label>
          <MultiSelect
            name="languages"
            options={languageOptions}
            defaultValues={initialProfile?.languages ?? []}
            placeholder={dict.common.notSelected}
          />
          <p className="text-xs text-muted-foreground">{dict.profile.languagesHint}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="nationalities">{dict.profile.nationalitiesLabel}</Label>
          <MultiSelect
            name="nationalities"
            options={countryOptions}
            defaultValues={initialProfile?.nationalities ?? []}
            placeholder={dict.common.notSelected}
          />
          <p className="text-xs text-muted-foreground">{dict.profile.nationalitiesHint}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lived_countries">{dict.profile.livedCountriesLabel}</Label>
          <MultiSelect
            name="lived_countries"
            options={countryOptions}
            defaultValues={initialProfile?.lived_countries ?? []}
            placeholder={dict.common.notSelected}
          />
          <p className="text-xs text-muted-foreground">{dict.profile.livedCountriesHint}</p>
        </div>
      </div>

      <div className="grid gap-2 border-t border-border pt-4">
        <Label htmlFor="self_intro">{dict.profile.selfIntroLabel}</Label>
        <Textarea
          id="self_intro"
          name="self_intro"
          rows={4}
          maxLength={500}
          placeholder={dict.profile.selfIntroPlaceholder}
          defaultValue={initialProfile?.self_intro ?? ""}
        />
        <p className="text-xs text-muted-foreground">{dict.profile.selfIntroHint}</p>
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">{dict.profile.snsSectionTitle}</p>
          <p className="text-xs text-muted-foreground">{dict.profile.snsSectionHint}</p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="instagram_handle">{dict.profile.instagramLabel}</Label>
          <Input
            id="instagram_handle"
            name="instagram_handle"
            placeholder={dict.profile.instagramPlaceholder}
            defaultValue={initialProfile?.instagram_handle ?? ""}
          />
          <p className="text-xs text-muted-foreground">{dict.profile.instagramHint}</p>
        </div>

        <div className="grid gap-2">
          <Label>{dict.profile.lineLabel}</Label>
          <LineQrUploader
            hasQr={!!initialProfile?.line_qr_path}
            initialSignedUrl={initialLineQrSignedUrl}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton
        label={submitLabel ?? dict.profile.submitSetup}
        pendingLabel={dict.profile.sending}
      />
    </form>
  );
}
