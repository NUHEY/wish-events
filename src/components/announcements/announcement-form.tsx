"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TeamPicker } from "@/components/team/team-picker";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { useDict } from "@/lib/i18n/locale-provider";
import type { AnnouncementRow, TeamMemberRow } from "@/types/database";
import type { ActionResult } from "@/actions/announcements";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

function SubmitButton({ label, savingLabel }: { label: string; savingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? savingLabel : label}
    </Button>
  );
}

export function AnnouncementForm({
  action,
  initialAnnouncement,
  submitLabel,
  teamMembers = [],
}: {
  action: FormAction;
  initialAnnouncement?: AnnouncementRow;
  submitLabel: string;
  teamMembers?: TeamMemberRow[];
}) {
  const dict = useDict();
  const [state, formAction] = useFormState<ActionResult, FormData>(action, undefined);
  const [coverImageUrl, setCoverImageUrl] = useState(initialAnnouncement?.cover_image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [body, setBody] = useState(initialAnnouncement?.body ?? "");
  const [showPreview, setShowPreview] = useState(false);

  async function handleCoverFile(file: File) {
    setUploading(true);
    setUploadError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `announcements/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("event-posters").upload(path, file, {
      upsert: false,
    });

    if (error) {
      setUploadError(`${error.message}`);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("event-posters").getPublicUrl(path);
    setCoverImageUrl(data.publicUrl);
    setUploading(false);
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="cover_image_url" value={coverImageUrl} />

      <div className="grid gap-2">
        <Label htmlFor="title">{dict.announcementForm.titleLabel}</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={initialAnnouncement?.title}
          placeholder={dict.announcementForm.titlePlaceholder}
        />
      </div>

      <div className="grid gap-2 sm:w-1/2">
        <Label htmlFor="category_label">{dict.announcementForm.categoryLabel}</Label>
        <Input
          id="category_label"
          name="category_label"
          defaultValue={initialAnnouncement?.category_label ?? ""}
          placeholder={dict.announcementForm.categoryPlaceholder}
        />
        <p className="text-xs text-muted-foreground">{dict.announcementForm.categoryHint}</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="cover">{dict.announcementForm.coverLabel}</Label>
        <ImageDropzone value={coverImageUrl} onFile={handleCoverFile} disabled={uploading} label={dict.announcementForm.coverLabel} />
        {uploading && (
          <p className="text-sm text-muted-foreground">{dict.eventForm.uploading}</p>
        )}
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="body">{dict.announcementForm.bodyLabel}</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? dict.eventForm.previewToggleOff : dict.eventForm.previewToggleOn}
          </Button>
        </div>
        {showPreview ? (
          <div className="prose prose-sm max-w-none rounded-md border border-input bg-background p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {body || dict.eventForm.noContent}
            </ReactMarkdown>
          </div>
        ) : (
          <Textarea
            id="body"
            name="body"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={dict.announcementForm.bodyPlaceholder}
          />
        )}
        <p className="text-xs text-muted-foreground">{dict.announcementForm.bodyHint}</p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="pinned" defaultChecked={initialAnnouncement?.pinned ?? false} />
        {dict.announcementForm.pinnedLabel}
      </label>

      <TeamPicker
        members={teamMembers}
        initialMemberIds={initialAnnouncement?.member_ids ?? []}
        initialAllRa={initialAnnouncement?.all_ra_members ?? false}
      />

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton label={submitLabel} savingLabel={dict.eventForm.saving} />
      </div>
    </form>
  );
}
