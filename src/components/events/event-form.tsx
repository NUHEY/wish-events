"use client";

import { useState } from "react";
import Link from "next/link";
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
import { EVENT_CATEGORIES, FLOORS, SURVEY_TYPES } from "@/lib/constants";
import { useDict } from "@/lib/i18n/locale-provider";
import type { EventRow } from "@/types/database";
import type { ActionResult } from "@/actions/events";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

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
}: {
  action: FormAction;
  initialEvent?: EventRow;
  submitLabel: string;
}) {
  const dict = useDict();
  const [state, formAction] = useFormState<ActionResult, FormData>(action, undefined);
  const [posterUrl, setPosterUrl] = useState(initialEvent?.poster_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [requiresRegistration, setRequiresRegistration] = useState(
    initialEvent?.requires_registration ?? false
  );
  const [surveyType, setSurveyType] = useState(initialEvent?.survey_type ?? "none");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(initialEvent?.description_en ?? "");
  const [showPreview, setShowPreview] = useState(false);
  const [showPreviewEn, setShowPreviewEn] = useState(false);

  async function handlePosterChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="poster_url" value={posterUrl} />

      <div className="grid gap-2">
        <Label htmlFor="title">{dict.eventForm.titleLabel}</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={initialEvent?.title}
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
        <Select id="category" name="category" required defaultValue={initialEvent?.category}>
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
        <Input id="poster" type="file" accept="image/*" onChange={handlePosterChange} />
        {uploading && <p className="text-sm text-muted-foreground">{dict.eventForm.uploading}</p>}
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="poster preview" className="mt-2 h-40 w-auto rounded-md border object-cover" />
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">{dict.eventForm.descriptionLabel}</Label>
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
            defaultValue={initialEvent?.location ?? ""}
            placeholder={dict.eventForm.locationPlaceholder}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location_en">{dict.eventForm.locationEnLabel}</Label>
          <Input
            id="location_en"
            name="location_en"
            defaultValue={initialEvent?.location_en ?? ""}
            placeholder={dict.eventForm.locationEnPlaceholder}
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="target_audience">{dict.eventForm.audienceLabel}</Label>
          <Input
            id="target_audience"
            name="target_audience"
            defaultValue={initialEvent?.target_audience ?? ""}
            placeholder={dict.eventForm.audiencePlaceholder}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="target_audience_en">{dict.eventForm.audienceEnLabel}</Label>
          <Input
            id="target_audience_en"
            name="target_audience_en"
            defaultValue={initialEvent?.target_audience_en ?? ""}
            placeholder={dict.eventForm.audienceEnPlaceholder}
          />
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
      </fieldset>

      <div className="grid gap-2 sm:w-1/2">
        <Label>{dict.eventForm.dateLabel}</Label>
        <DateTimePicker
          name="event_date"
          required
          defaultValue={
            initialEvent
              ? new Date(initialEvent.event_date).toISOString().slice(0, 16)
              : undefined
          }
        />
      </div>

      <fieldset className="grid gap-2 rounded-md border border-border p-3 sm:w-1/2">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.publishLegend}</legend>
        <DateTimePicker
          name="publish_at"
          defaultValue={
            initialEvent?.publish_at
              ? new Date(initialEvent.publish_at).toISOString().slice(0, 16)
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

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">{dict.eventForm.registrationLegend}</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="requires_registration"
            checked={requiresRegistration}
            onCheckedChange={(checked) => setRequiresRegistration(checked === true)}
          />
          {dict.eventForm.registrationRequired}
        </label>
        {requiresRegistration && (
          <>
            <div className="grid gap-2 sm:w-1/3">
              <Label htmlFor="capacity">{dict.eventForm.capacityLabel}</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min={1}
                required={requiresRegistration}
                defaultValue={initialEvent?.capacity ?? undefined}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{dict.eventForm.registrationOpensLabel}</Label>
                <DateTimePicker
                  name="registration_opens_at"
                  defaultValue={
                    initialEvent?.registration_opens_at
                      ? new Date(initialEvent.registration_opens_at).toISOString().slice(0, 16)
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
                      ? new Date(initialEvent.registration_closes_at).toISOString().slice(0, 16)
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
        )}
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
            defaultValue={initialEvent?.contact_info ?? ""}
            placeholder={dict.eventForm.contactInfoPlaceholder}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="notes">{dict.eventForm.notesLabel}</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={initialEvent?.notes ?? ""}
            placeholder={dict.eventForm.notesPlaceholder}
          />
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton label={submitLabel} savingLabel={dict.eventForm.saving} />
      </div>
    </form>
  );
}
