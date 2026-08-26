"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { updateSiteSettings, uploadOgImage, removeOgImage, type SiteSettingsActionResult } from "@/actions/site-settings";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中…" : "保存する"}
    </Button>
  );
}

export function SiteSettingsForm({
  initialTitle,
  initialDescription,
  initialImageUrl,
  defaultTitle,
  defaultDescription,
}: {
  initialTitle: string;
  initialDescription: string;
  initialImageUrl: string | null;
  defaultTitle: string;
  defaultDescription: string;
}) {
  const [state, formAction] = useFormState<SiteSettingsActionResult, FormData>(updateSiteSettings, {});
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) toast.success("保存しました");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.append("og_image", file);
      const result = await uploadOgImage(formData);
      if (result.error) toast.error(result.error);
      else {
        setImageUrl(result.url ?? null);
        toast.success("画像を更新しました");
      }
    });
  }

  function handleRemoveImage() {
    startTransition(async () => {
      const result = await removeOgImage();
      if (result.error) toast.error(result.error);
      else {
        setImageUrl(null);
        toast.success("既定のデザインに戻しました");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PendingFeedback active={pending} label="OGP画像を更新しています…" />
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-bold">共有時のプレビュー画像</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            LINEやSlack等にURLを貼った際に表示される画像です。未設定の場合はWISHのブランドカラーを使った既定のデザインが自動で使われます。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative aspect-[1.91/1] w-56 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/40">
            {imageUrl ? (
              <Image src={imageUrl} alt="" fill sizes="224px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
                既定のデザインを使用中
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <ImagePlus className="h-4 w-4" />
              画像をアップロード
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={handleRemoveImage}
                className="gap-1.5 text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
                既定のデザインに戻す
              </Button>
            )}
            <p className="text-xs text-muted-foreground">推奨サイズ 1200×630px、5MBまで（png / jpeg / webp）。</p>
          </div>
        </div>
      </section>

      <form action={formAction} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <h2 className="font-bold">タイトル・説明文</h2>
          <p className="mt-1 text-sm text-muted-foreground">未入力の場合は既定の文言が使われます。</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="og_title">タイトル</Label>
          <Input id="og_title" name="og_title" defaultValue={initialTitle} placeholder={defaultTitle} maxLength={100} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="og_description">説明文</Label>
          <Input
            id="og_description"
            name="og_description"
            defaultValue={initialDescription}
            placeholder={defaultDescription}
            maxLength={200}
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div>
          <SaveButton />
        </div>
      </form>
    </div>
  );
}
