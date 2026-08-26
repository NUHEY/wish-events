"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { LineQrUploader } from "@/components/profile/line-qr-uploader";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileCoverUploader } from "@/components/profile/profile-cover-uploader";
import { ProfileSingleSelect } from "@/components/profile/profile-single-select";
import { FACULTIES, GRADE_LEVELS, FLOORS, PROFILE_ACCENT_KEYS, PROFILE_ACCENT_HEX } from "@/lib/constants";
import { LANGUAGES, COUNTRIES } from "@/lib/i18n/profile-options";
import { parseFullRoomNumber } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { submitProfile } from "@/actions/profile";
import { useDirtyForm } from "@/lib/hooks/use-dirty-form";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
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
  | "avatar_url"
  | "profile_cover_url"
  | "line_id"
  | "x_handle"
  | "profile_accents"
>;

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? pendingLabel : label}
    </Button>
  );
}

/** 必須/任意を一目でわかるようにする小さなタグ。ラベルの右に添える。 */
function RequirementTag({ required }: { required?: boolean }) {
  const dict = useDict();
  return (
    <span
      className={
        required
          ? "rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary"
          : "rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground"
      }
    >
      {required ? dict.profile.requiredLabel : dict.profile.optionalLabel}
    </span>
  );
}

/** ラベル＋必須/任意タグ＋（任意で）複数選択可タグをまとめて並べる行。 */
function FieldLabel({
  htmlFor,
  required,
  multiple,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  multiple?: boolean;
  children: React.ReactNode;
}) {
  const dict = useDict();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      <RequirementTag required={required} />
      {multiple && (
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {dict.profile.multipleSelectionLabel}
        </span>
      )}
    </div>
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
  const [state, formAction] = useFormState(
    async (prev: Parameters<typeof submitProfile>[0], formData: FormData) => {
      // 保存を開始した時点で「未保存の変更あり」フラグを解除する。
      // 消さないままだと、保存成功後のページ遷移中にブラウザ標準の
      // 「このページを離れますか」警告が誤って表示されてしまう。
      reset();
      return submitProfile(prev, formData);
    },
    undefined
  );

  const languageOptions = LANGUAGES.map((l) => ({ code: l.code, label: l[locale] }));
  const countryOptions = COUNTRIES.map((c) => ({ code: c.code, label: c[locale] }));

  const [roomNumberInput, setRoomNumberInput] = useState(
    initialProfile?.floor_number != null && initialProfile?.room_number
      ? `${initialProfile.floor_number}${initialProfile.room_number}`
      : ""
  );
  const parsedRoom = parseFullRoomNumber(roomNumberInput);
  const MAX_ACCENTS = 5;
  const [accents, setAccents] = useState<string[]>(initialProfile?.profile_accents ?? []);

  function toggleAccent(key: string) {
    setAccents((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_ACCENTS) return prev;
      return [...prev, key];
    });
  }

  const { formRef, isDirty, markDirty, reset } = useDirtyForm();
  useUnsavedChangesGuard(isDirty, dict.common.unsavedChangesConfirm);

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={markDirty}
      onChange={markDirty}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-3 pb-2">
        <ProfileCoverUploader initialUrl={initialProfile?.profile_cover_url ?? null} />
        <AvatarUploader initialUrl={initialProfile?.avatar_url ?? null} />
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="full_name" required>
          {dict.profile.fullNameLabel}
        </FieldLabel>
        <Input
          id="full_name"
          name="full_name"
          required
          placeholder={dict.profile.fullNamePlaceholder}
          defaultValue={initialProfile?.full_name ?? ""}
        />
      </div>

      <div className="grid gap-2">
        <FieldLabel htmlFor="student_id" required>
          {dict.profile.studentIdLabel}
        </FieldLabel>
        <Input
          id="student_id"
          name="student_id"
          required
          maxLength={8}
          placeholder={dict.profile.studentIdPlaceholder}
          defaultValue={initialProfile?.student_id ?? ""}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="grid gap-2">
          <FieldLabel htmlFor="room_number" required>
            {dict.profile.roomNumberLabel}
          </FieldLabel>
          <Input
            id="room_number"
            name="room_number"
            required
            maxLength={5}
            placeholder={dict.profile.roomNumberPlaceholder}
            value={roomNumberInput}
            onChange={(e) => setRoomNumberInput(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="floor_number_display">{dict.profile.floorLabel}</Label>
          <Select
            id="floor_number_display"
            disabled
            value={parsedRoom?.floorNumber ?? ""}
            className="w-24"
            aria-readonly
          >
            <option value="">{dict.profile.floorPlaceholder}</option>
            {FLOORS.map((f) => (
              <option key={f} value={f}>
                {f}
                {dict.event.floorUnit}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">{dict.profile.extraSectionTitle}</p>
          <p className="text-xs text-muted-foreground">{dict.profile.extraSectionHint}</p>
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="faculty">{dict.profile.facultyLabel}</FieldLabel>
          <ProfileSingleSelect
            id="faculty"
            name="faculty"
            defaultValue={initialProfile?.faculty ?? ""}
            placeholder={dict.common.notSelected}
            options={FACULTIES.map((faculty) => ({ value: faculty, label: dict.faculties[faculty] }))}
            onValueChange={markDirty}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="grade_level">{dict.profile.gradeLevelLabel}</FieldLabel>
          <ProfileSingleSelect
            id="grade_level"
            name="grade_level"
            defaultValue={initialProfile?.grade_level ?? ""}
            placeholder={dict.common.notSelected}
            options={GRADE_LEVELS.map((grade) => ({ value: grade, label: dict.gradeLevels[grade] }))}
            onValueChange={markDirty}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="languages" multiple>
            {dict.profile.languagesLabel}
          </FieldLabel>
          <MultiSelect
            name="languages"
            options={languageOptions}
            defaultValues={initialProfile?.languages ?? []}
            placeholder={dict.common.notSelected}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="nationalities" multiple>
            {dict.profile.nationalitiesLabel}
          </FieldLabel>
          <MultiSelect
            name="nationalities"
            options={countryOptions}
            defaultValues={initialProfile?.nationalities ?? []}
            placeholder={dict.common.notSelected}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="lived_countries" multiple>
            {dict.profile.livedCountriesLabel}
          </FieldLabel>
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
        <FieldLabel htmlFor="self_intro">{dict.profile.selfIntroLabel}</FieldLabel>
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
          <FieldLabel htmlFor="instagram_handle">{dict.profile.instagramLabel}</FieldLabel>
          <Input
            id="instagram_handle"
            name="instagram_handle"
            placeholder={dict.profile.instagramPlaceholder}
            defaultValue={initialProfile?.instagram_handle ?? ""}
          />
          <p className="text-xs text-muted-foreground">{dict.profile.instagramHint}</p>
        </div>

        <div className="grid gap-2">
          <FieldLabel>{dict.profile.lineLabel}</FieldLabel>
          <LineQrUploader
            hasQr={!!initialProfile?.line_qr_path}
            initialSignedUrl={initialLineQrSignedUrl}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="line_id">{dict.profile.lineIdLabel}</FieldLabel>
          <Input
            id="line_id"
            name="line_id"
            placeholder={dict.profile.lineIdPlaceholder}
            defaultValue={initialProfile?.line_id ?? ""}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="x_handle">{dict.profile.xHandleLabel}</FieldLabel>
          <Input
            id="x_handle"
            name="x_handle"
            placeholder={dict.profile.xHandlePlaceholder}
            defaultValue={initialProfile?.x_handle ?? ""}
          />
          <p className="text-xs text-muted-foreground">{dict.profile.xHandleHint}</p>
        </div>
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">{dict.profile.decoSectionTitle}</p>
          <p className="text-xs text-muted-foreground">{dict.profile.decoSectionHint}</p>
        </div>
        <div className="grid gap-2">
          <FieldLabel>{dict.profile.accentLabel}</FieldLabel>
          {accents.map((a) => (
            <input key={a} type="hidden" name="profile_accents" value={a} />
          ))}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setAccents([]);
                markDirty();
              }}
              aria-label={dict.profile.accentNone}
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-muted-foreground transition-transform ${
                accents.length === 0 ? "border-foreground scale-110" : "border-border"
              }`}
            >
              <span className="h-4 w-4 rounded-full border border-dashed border-current" />
            </button>
            {PROFILE_ACCENT_KEYS.map((key) => {
              const selected = accents.includes(key);
              const disabled = !selected && accents.length >= MAX_ACCENTS;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    toggleAccent(key);
                    markDirty();
                  }}
                  aria-label={key}
                  aria-pressed={selected}
                  className={`relative h-8 w-8 shrink-0 rounded-full border-2 transition-transform ${
                    selected ? "border-foreground scale-110" : "border-transparent"
                  } ${disabled ? "cursor-not-allowed opacity-35" : ""}`}
                  style={{ backgroundColor: PROFILE_ACCENT_HEX[key] }}
                >
                  {selected && (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {accents.length}/{MAX_ACCENTS}
          </p>
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
