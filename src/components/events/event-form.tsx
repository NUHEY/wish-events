"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useFormState, useFormStatus } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TeamPicker } from "@/components/team/team-picker";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { MarkdownHelpButton } from "@/components/ui/markdown-help-button";
import { EVENT_CATEGORIES, FLOORS, SURVEY_TYPES } from "@/lib/constants";
import { utcIsoToJstWallClockInput } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import { useDirtyForm } from "@/lib/hooks/use-dirty-form";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
import type { EventRow, EventLocationOptionRow, EventAudienceOptionRow, TeamMemberRow } from "@/types/database";
import type { ActionResult } from "@/actions/events";
import type { EventImportDraft } from "@/lib/event-import";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

// 編集画面や通常のフォーム表示へExcel解析UIを混ぜないよう、新規作成時だけ遅延読込する。
const EventSheetImporter = dynamic(
  () => import("@/components/events/event-sheet-importer").then((module) => module.EventSheetImporter),
  { ssr: false }
);

function SubmitButton({ label, savingLabel }: { label: string; savingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? savingLabel : label}
    </Button>
  );
}

export function EventForm({
  action,
  initialEvent,
  submitLabel,
  locationOptions = [],
  audienceOptions = [],
  teamMembers = [],
}: {
  action: FormAction;
  initialEvent?: EventRow;
  submitLabel: string;
  locationOptions?: EventLocationOptionRow[];
  audienceOptions?: EventAudienceOptionRow[];
  teamMembers?: TeamMemberRow[];
}) {
  const dict = useDict();
  const [state, formAction] = useFormState<ActionResult, FormData>(
    async (prev, formData) => {
      // 保存を開始した時点で「未保存の変更あり」フラグを解除する。
      // 消さないままだと、保存成功後のredirect()によるページ遷移中に
      // ブラウザ標準の「このページを離れますか」警告が誤って表示されてしまう。
      reset();
      return action(prev, formData);
    },
    undefined
  );
  const [posterUrl, setPosterUrl] = useState(initialEvent?.poster_url ?? "");
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [category, setCategory] = useState(initialEvent?.category ?? "");
  const [location, setLocation] = useState(initialEvent?.location ?? "");
  const [targetAudience, setTargetAudience] = useState(initialEvent?.target_audience ?? "");
  const [capacity, setCapacity] = useState(initialEvent?.capacity ? String(initialEvent.capacity) : "");
  const [notes, setNotes] = useState(initialEvent?.notes ?? "");
  const [contactInfo, setContactInfo] = useState(initialEvent?.contact_info ?? "");
  const [eventDateDefault, setEventDateDefault] = useState(
    initialEvent ? utcIsoToJstWallClockInput(initialEvent.event_date) : undefined
  );
  const [eventDateRevision, setEventDateRevision] = useState(0);
  const [importedMemberIds, setImportedMemberIds] = useState(initialEvent?.member_ids ?? []);
  const [teamPickerRevision, setTeamPickerRevision] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [surveyType, setSurveyType] = useState(initialEvent?.survey_type ?? "none");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initialEvent?.description_en ?? "");
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewEn, setShowPreviewEn] = useState(false);

  const { formRef, isDirty, markDirty, reset } = useDirtyForm();
  useUnsavedChangesGuard(isDirty, dict.common.unsavedChangesConfirm);

  function applyImportedDraft(draft: EventImportDraft) {
    if (draft.title) setTitle(draft.title);
    if (draft.category) setCategory(draft.category);
    if (draft.description) setDescription(draft.description);
    if (draft.location) setLocation(draft.location);
    if (draft.targetAudience) setTargetAudience(draft.targetAudience);
    if (draft.capacity) setCapacity(String(draft.capacity));
    if (draft.notes) setNotes(draft.notes);
    if (draft.contactInfo) setContactInfo(draft.contactInfo);
    if (draft.eventDate) {
      setEventDateDefault(draft.eventDate);
      setEventDateRevision((current) => current + 1);
    }

    const matchedIds = draft.organizerNames.flatMap((sourceName) => {
      const normalizedSource = sourceName.replaceAll(/\s+/g, "").toLocaleLowerCase("ja");
      const matches = teamMembers.filter((member) => {
        const normalizedMember = (member.full_name ?? "").replaceAll(/\s+/g, "").toLocaleLowerCase("ja");
        return normalizedMember === normalizedSource || normalizedMember.includes(normalizedSource);
      });
      return matches.length === 1 ? [matches[0].id] : [];
    });
    const uniqueIds = [...new Set(matchedIds)];
    if (uniqueIds.length > 0) {
      setImportedMemberIds(uniqueIds);
      setTeamPickerRevision((current) => current + 1);
    }
    markDirty();
  }

  async function handlePosterFile(file: File) {
    setUploading(true);
    setUploadError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("event-posters").upload(path, file, {
      upsert: false,
    });

    if (error) {
      setUploadError(`${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("event-posters").getPublicUrl(path);
    setPosterUrl(data.publicUrl);
    setUploading(false);
    markDirty();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onInput={markDirty}
      onChange={markDirty}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="poster_url" value={posterUrl} />

      {!initialEvent && <EventSheetImporter onImported={applyImportedDraft} />}

      <div className="grid gap-2">
        <Label htmlFor="title">{dict.eventForm.titleLabel}</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={dict.eventForm.titlePlaceholder}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="title_en">{dict.eventForm.titleEnLabel}</Label>
        <Input
          id="title_en"
          name="title_en"
          defaultValue={initialEvent?.title_en ?? ""}
          placeholder={dict.eventForm.titleEnPlaceholder}
        />
        <p className="text-xs text-muted-foreground">{dict.eventForm.titleEnHint}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">{dict.eventForm.categoryLabel}</Label>
        <Select id="category" name="category" required value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
          <option value="" disabled>
            {dict.eventForm.categoryPlaceholder}
          </option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {dict.categories[c] ?? c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="poster">{dict.eventForm.posterLabel}</Label>
        <ImageDropzone value={posterUrl} onFile={handlePosterFile} disabled={uploading} label={dict.eventForm.posterLabel} />
        {uploading && <p className="text-sm text-muted-foreground">{dict.eventForm.uploading}</p>}
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="description">{dict.eventForm.descriptionLabel}</Label>
            <MarkdownHelpButton />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? dict.eventForm.previewToggleOff : dict.eventForm.previewToggleOn}
          </Button>
        </div>
        {showPreview ? (
          <div className="prose prose-sm max-w-none rounded-md border border-input bg-background p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {description || dict.eventForm.noContent}
            </ReactMarkdown>
          </div>
        ) : (
          <Textarea
            id="description"
            name="description"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={dict.eventForm.descriptionPlaceholder}
          />
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description_en">{dict.eventForm.descriptionEnLabel}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreviewEn((v) => !v)}>
            {showPreviewEn ? dict.eventForm.previewToggleOff : dict.eventForm.previewToggleOn}
          </Button>
        </div>
        {showPreviewEn ? (
          <div className="prose prose-sm max-w-none rounded-md border border-input bg-background p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {descriptionEn || dict.eventForm.noContent}
            </ReactMarkdown>
          </div>
        ) : (
          <Textarea
            id="description_en"
            name="description_en"
            rows={8}
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            placeholder={dict.eventForm.descriptionPlaceholder}
          />
        )}
        <p className="text-xs text-muted-foreground">{dict.eventForm.descriptionEnHint}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="location">{dict.eventForm.locationLabel}</Label>
          <Input
            id="location"
            name="location"
            list="location-options-ja"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={dict.eventForm.locationPlaceholder}
          />
          <datalist id="location-options-ja">
            {locationOptions.map((o) => (
              <option key={o.id} value={o.label_ja} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location_en">{dict.eventForm.locationEnLabel}</Label>
          <Input
            id="location_en"
            name="location_en"
            list="location-options-en"
            defaultValue={initialEvent?.location_en ?? ""}
            placeholder={dict.eventForm.locationEnPlaceholder}
          />
          <datalist id="location-options-en">
            {locationOptions
              .filter((o) => o.label_en)
              .map((o) => (
                <option key={o.id} value={o.label_en ?? ""} />
              ))}
          </datalist>
        </div>
        <p className="-mt-1 text-xs text-muted-foreground sm:col-span-2">
          {dict.eventForm.optionsManageHint}{" "}
          <Link href="/dashboard/event-options" className="text-primary hover:underline">
            {dict.eventOptions.navLabel}
          </Link>
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="target_audience">{dict.eventForm.audienceLabel}</Label>
          <Input
            id="target_audience"
            name="target_audience"
            list="audience-options-ja"
            value={targetAudience}
            onChange={(event) => setTargetAudience(event.target.value)}
            placeholder={dict.eventForm.audiencePlaceholder}
          />
          <datalist id="audience-options-ja">
            {audienceOptions.map((o) => (
              <option key={o.id} value={o.label_ja} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="target_audience_en">{dict.eventForm.audienceEnLabel}</Label>
          <Input
            id="target_audience_en"
            name="target_audience_en"
            list="audience-options-en"
            defaultValue={initialEvent?.target_audience_en ?? ""}
            placeholder={dict.eventForm.audienceEnPlaceholder}
          />
          <datalist id="audience-options-en">
            {audienceOptions
              .filter((o) => o.label_en)
              .map((o) => (
                <option key={o.id} value={o.label_en ?? ""} />
              ))}
          </datalist>
        </div>
      </div>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.feeLegend}</legend>
        <div className="grid gap-2 sm:w-1/3">
          <Label htmlFor="fee_amount">{dict.eventForm.feeAmountLabel}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="fee_amount"
              name="fee_amount"
              type="number"
              min={0}
              step={1}
              placeholder={dict.eventForm.feeAmountPlaceholder}
              defaultValue={initialEvent?.fee_amount ?? undefined}
            />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {dict.eventForm.feeUnit}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{dict.eventForm.feeAmountHint}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="show_free_tag" defaultChecked={initialEvent?.show_free_tag ?? true} />
          金額未設定の場合、一覧に「無料」タグを表示する
        </label>
        <div className="grid gap-2">
          <Label htmlFor="payment_info">{dict.eventForm.paymentInfoLabel}</Label>
          <Textarea
            id="payment_info"
            name="payment_info"
            rows={3}
            placeholder={dict.eventForm.paymentInfoPlaceholder}
            defaultValue={initialEvent?.payment_info ?? ""}
          />
          <p className="text-xs text-muted-foreground">{dict.eventForm.paymentInfoHint}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>集金期限（任意）</Label>
            <DateTimePicker name="payment_due_at" defaultValue={initialEvent?.payment_due_at ? utcIsoToJstWallClockInput(initialEvent.payment_due_at) : undefined} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment_destination">支払先・振込先（任意）</Label>
            <Textarea id="payment_destination" name="payment_destination" rows={3} placeholder="例：○○銀行 ○○支店 普通 1234567 / 口座名義" defaultValue={initialEvent?.payment_destination ?? ""} />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-2 sm:w-1/2">
        <Label>{dict.eventForm.dateLabel}</Label>
        <DateTimePicker
          key={`event-date-${eventDateRevision}`}
          name="event_date"
          required
          defaultValue={eventDateDefault}
        />
      </div>

      <fieldset className="grid gap-2 rounded-md border border-border p-3 sm:w-1/2">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.publishLegend}</legend>
        <DateTimePicker
          name="publish_at"
          defaultValue={
            initialEvent?.publish_at
              ? utcIsoToJstWallClockInput(initialEvent.publish_at)
              : undefined
          }
        />
        <p className="text-xs text-muted-foreground">{dict.eventForm.publishHint}</p>
      </fieldset>

      <fieldset className="grid gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.targetFloorsLegend}</legend>
        <p className="text-xs text-muted-foreground">{dict.eventForm.targetFloorsHint}</p>
        <div className="flex flex-wrap gap-3">
          {FLOORS.map((f) => (
            <label key={f} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                name="target_floors"
                value={String(f)}
                defaultChecked={initialEvent?.target_floors?.includes(f)}
              />
              {f}
              {dict.event.floorUnit}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xl border border-border bg-secondary/20 p-3.5">
        <legend className="px-1 text-sm font-semibold">参加受付</legend>
        <p className="text-xs text-muted-foreground">すべてのイベントで参加受付を行います。定員は必要なときだけ設定してください。</p>
          <>
            <div className="grid gap-2 sm:w-1/3">
              <Label htmlFor="capacity">定員（空欄なら無制限）</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{dict.eventForm.registrationOpensLabel}</Label>
                <DateTimePicker
                  name="registration_opens_at"
                  defaultValue={
                    initialEvent?.registration_opens_at
                      ? utcIsoToJstWallClockInput(initialEvent.registration_opens_at)
                      : undefined
                  }
                />
                <p className="text-xs text-muted-foreground">{dict.eventForm.registrationOpensHint}</p>
              </div>
              <div className="grid gap-2">
                <Label>{dict.eventForm.registrationClosesLabel}</Label>
                <DateTimePicker
                  name="registration_closes_at"
                  defaultValue={
                    initialEvent?.registration_closes_at
                      ? utcIsoToJstWallClockInput(initialEvent.registration_closes_at)
                      : undefined
                  }
                />
                <p className="text-xs text-muted-foreground">{dict.eventForm.registrationClosesHint}</p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <p className="text-xs text-muted-foreground">
                {initialEvent
                  ? dict.eventForm.registrationQuestionsHintEdit
                  : dict.eventForm.registrationQuestionsHintNew}
              </p>
              {initialEvent && (
                <Link
                  href={`/events/${initialEvent.id}/questions`}
                  className="w-fit text-xs font-medium text-primary hover:underline"
                >
                  {dict.event.questionsManageButton}
                </Link>
              )}
            </div>
          </>
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.surveyLegend}</legend>
        <div className="grid gap-2 sm:w-1/2">
          <Select
            name="survey_type"
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value as typeof surveyType)}
          >
            <option value="none">{dict.eventForm.surveyNone}</option>
            <option value="external">{dict.eventForm.surveyExternal}</option>
            <option value="internal">{dict.eventForm.surveyInternal}</option>
          </Select>
        </div>
        {surveyType === "external" && (
          <div className="grid gap-2">
            <Label htmlFor="survey_external_url">{dict.eventForm.surveyUrlLabel}</Label>
            <Input
              id="survey_external_url"
              name="survey_external_url"
              type="url"
              placeholder="https://forms.gle/..."
              defaultValue={initialEvent?.survey_external_url ?? ""}
            />
          </div>
        )}
        {surveyType === "internal" && (
          <p className="text-sm text-muted-foreground">
            {initialEvent
              ? dict.eventForm.surveyInternalHintEdit
              : dict.eventForm.surveyInternalHintNew}
          </p>
        )}
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.advancedLegend}</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="is_pinned" defaultChecked={initialEvent?.is_pinned ?? false} />
          {dict.eventForm.pinnedLabel}
        </label>
        <p className="-mt-1.5 text-xs text-muted-foreground">{dict.eventForm.pinnedHint}</p>

        <div className="grid gap-2">
          <Label htmlFor="location_url">{dict.eventForm.locationUrlLabel}</Label>
          <Input
            id="location_url"
            name="location_url"
            type="url"
            defaultValue={initialEvent?.location_url ?? ""}
            placeholder={dict.eventForm.locationUrlPlaceholder}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="contact_info">{dict.eventForm.contactInfoLabel}</Label>
          <Input
            id="contact_info"
            name="contact_info"
            value={contactInfo}
            onChange={(event) => setContactInfo(event.target.value)}
            placeholder={dict.eventForm.contactInfoPlaceholder}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">{dict.eventForm.notesLabel}</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={dict.eventForm.notesPlaceholder}
          />
        </div>
      </fieldset>

      <TeamPicker
        key={`team-picker-${teamPickerRevision}`}
        members={teamMembers}
        initialMemberIds={importedMemberIds}
        initialAllRa={initialEvent?.all_ra_members ?? false}
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton label={submitLabel} savingLabel={dict.eventForm.saving} />
      </div>
    </form>
  );
}
