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
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EVENT_CATEGORIES, FLOORS, SURVEY_TYPES } from "@/lib/constants";
import type { EventRow } from "@/types/database";
import type { ActionResult } from "@/actions/events";

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中..." : label}
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
  const [state, formAction] = useFormState<ActionResult, FormData>(action, undefined);
  const [posterUrl, setPosterUrl] = useState(initialEvent?.poster_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [requiresRegistration, setRequiresRegistration] = useState(
    initialEvent?.requires_registration ?? false
  );
  const [surveyType, setSurveyType] = useState(initialEvent?.survey_type ?? "none");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [showPreview, setShowPreview] = useState(false);

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
      setUploadError(`アップロードに失敗しました: ${error.message}`);
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
        <Label htmlFor="title">タイトル</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={initialEvent?.title}
          placeholder="例: 秋の防災訓練"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">カテゴリ</Label>
        <Select id="category" name="category" required defaultValue={initialEvent?.category}>
          <option value="" disabled>
            選択してください
          </option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="poster">ポスター画像</Label>
        <Input id="poster" type="file" accept="image/*" onChange={handlePosterChange} />
        {uploading && <p className="text-sm text-muted-foreground">アップロード中...</p>}
        {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        {posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="poster preview" className="mt-2 h-40 w-auto rounded-md border object-cover" />
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">詳細内容（Markdown）</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? "編集に戻る" : "プレビュー"}
          </Button>
        </div>
        {showPreview ? (
          <div className="prose prose-sm max-w-none rounded-md border border-input bg-background p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{description || "(内容なし)"}</ReactMarkdown>
          </div>
        ) : (
          <Textarea
            id="description"
            name="description"
            rows={8}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Markdown記法で入力できます（見出し、箇条書き、リンクなど）"
          />
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="location">開催場所</Label>
          <Input id="location" name="location" defaultValue={initialEvent?.location ?? ""} placeholder="例: 1階ラウンジ" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="target_audience">対象者</Label>
          <Input
            id="target_audience"
            name="target_audience"
            defaultValue={initialEvent?.target_audience ?? ""}
            placeholder="例: 全寮生 / 新入寮生のみ"
          />
        </div>
      </div>

      <div className="grid gap-2 sm:w-1/2">
        <Label htmlFor="event_date">開催日時</Label>
        <Input
          id="event_date"
          name="event_date"
          type="datetime-local"
          required
          defaultValue={
            initialEvent
              ? new Date(initialEvent.event_date).toISOString().slice(0, 16)
              : undefined
          }
        />
      </div>

      <fieldset className="grid gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">配信対象フロア</legend>
        <p className="text-xs text-muted-foreground">
          未選択の場合は全フロアに表示されます。特定フロアだけに配信したい場合はチェックしてください（例: 3階と11階だけ）。
        </p>
        <div className="flex flex-wrap gap-3">
          {FLOORS.map((f) => (
            <label key={f} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                name="target_floors"
                value={String(f)}
                defaultChecked={initialEvent?.target_floors?.includes(f)}
              />
              {f}階
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">事前申し込み</legend>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            name="requires_registration"
            checked={requiresRegistration}
            onCheckedChange={(checked) => setRequiresRegistration(checked === true)}
          />
          事前申し込みを必須にする
        </label>
        {requiresRegistration && (
          <div className="grid gap-2 sm:w-1/3">
            <Label htmlFor="capacity">定員</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              required={requiresRegistration}
              defaultValue={initialEvent?.capacity ?? undefined}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">イベント後アンケート</legend>
        <div className="grid gap-2 sm:w-1/2">
          <Select
            name="survey_type"
            value={surveyType}
            onChange={(e) => setSurveyType(e.target.value as typeof surveyType)}
          >
            <option value="none">なし</option>
            <option value="external">外部フォーム（Googleフォーム等のURL）</option>
            <option value="internal">サイト内蔵アンケート</option>
          </Select>
        </div>
        {surveyType === "external" && (
          <div className="grid gap-2">
            <Label htmlFor="survey_external_url">アンケートURL</Label>
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
              ? "保存後、管理ダッシュボードの「アンケート管理」から質問を設定できます。"
              : "作成後、管理ダッシュボードの「アンケート管理」から質問を設定してください。"}
          </p>
        )}
      </fieldset>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
