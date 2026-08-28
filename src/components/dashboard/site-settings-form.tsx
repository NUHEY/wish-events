"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useFormState, useFormStatus } from "react-dom";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { updateSiteSettings, uploadOgImage, removeOgImage, uploadBrandIcon, removeBrandIcon, type SiteSettingsActionResult } from "@/actions/site-settings";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中…" : "保存する"}
    </Button>
  );
}

function BrandIconSetting({ kind, initialUrl, title, note }: { kind: "favicon" | "apple"; initialUrl: string | null; title: string; note: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-secondary/40">
        {url ? <Image src={url} alt="" fill sizes="56px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-lg font-black text-primary">W</div>}
      </div>
      <div className="min-w-0 flex-1"><p className="text-sm font-bold">{title}</p><p className="text-[11px] leading-relaxed text-muted-foreground">{note}</p><div className="mt-2 flex flex-wrap gap-1.5"><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; startTransition(async () => { const data = new FormData(); data.append("asset_kind", kind); data.append("brand_icon", file); const result = await uploadBrandIcon(data); if (result.error) toast.error(result.error); else { setUrl(result.url ?? null); toast.success("アイコンを更新しました"); } }); }} /><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}><ImagePlus className="h-3.5 w-3.5" />変更</Button>{url && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(async () => { const result = await removeBrandIcon(kind); if (result.error) toast.error(result.error); else { setUrl(null); toast.success("既定アイコンに戻しました"); } })}><Trash2 className="h-3.5 w-3.5" />戻す</Button>}</div></div>
    </div>
  );
}

export function SiteSettingsForm({
  initialTitle,
  initialDescription,
  initialImageUrl,
  initialFaviconUrl,
  initialAppleTouchIconUrl,
  initialAppShortName,
  initialThemeColor,
  defaultTitle,
  defaultDescription,
  initialAccentColor,
  initialColorfulStatus,
  defaultAccentColor,
  navigationLockEnabled,
  navigationStallSeconds,
  mobileTouchFeedbackEnabled,
  mobileTouchFeedbackMs,
  motionLevel,
  ctaBlurPx,
  ctaFadeHeightPx,
  ctaTransitionMs,
}: {
  initialTitle: string;
  initialDescription: string;
  initialImageUrl: string | null;
  initialFaviconUrl: string | null;
  initialAppleTouchIconUrl: string | null;
  initialAppShortName: string;
  initialThemeColor: string;
  defaultTitle: string;
  defaultDescription: string;
  initialAccentColor: string;
  initialColorfulStatus: boolean;
  defaultAccentColor: string;
  navigationLockEnabled: boolean;
  navigationStallSeconds: number;
  mobileTouchFeedbackEnabled: boolean;
  mobileTouchFeedbackMs: number;
  motionLevel: "subtle" | "standard" | "lively";
  ctaBlurPx: number;
  ctaFadeHeightPx: number;
  ctaTransitionMs: number;
}) {
  const [accentColor, setAccentColor] = useState(initialAccentColor);
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
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div><h2 className="font-bold">アプリアイコン</h2><p className="mt-1 text-sm text-muted-foreground">ブラウザのタブとスマホのホーム画面で使う画像です。正方形で、端に十分な余白がある画像が適しています。</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <BrandIconSetting kind="favicon" initialUrl={initialFaviconUrl} title="ブラウザアイコン" note="推奨 512×512px。タブやブックマークに表示します。" />
          <BrandIconSetting kind="apple" initialUrl={initialAppleTouchIconUrl} title="スマホホーム画面" note="推奨 512×512px。未設定時はブラウザアイコンを使います。" />
        </div>
      </section>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="app_short_name">ホーム画面での短い名前</Label><Input id="app_short_name" name="app_short_name" defaultValue={initialAppShortName} maxLength={20} placeholder="WISH" /><p className="text-xs text-muted-foreground">スマホへ追加した時に表示します。</p></div>
          <div className="grid gap-1.5"><Label htmlFor="theme_color">ブラウザのテーマ色</Label><div className="flex items-center gap-2"><input id="theme_color" type="color" name="theme_color" defaultValue={initialThemeColor} className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-card p-1" /><span className="text-xs text-muted-foreground">ブラウザ上部などに使われます</span></div></div>
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
        <div className="border-t border-border pt-4">
          <h2 className="font-bold">サイトカラー</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ボタンやリンクなど、サイトの主要な操作に使うアクセントカラーです。それ以外の土台部分は白黒で統一されています。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="color"
              name="accent_color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded-lg border border-border bg-card p-1"
              aria-label="アクセントカラー"
            />
            <span className="text-sm text-muted-foreground">{accentColor}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAccentColor(defaultAccentColor)}>
              早稲田カラーに戻す
            </Button>
          </div>
          <label className="mt-4 flex items-start gap-2 text-sm">
            <input type="checkbox" name="colorful_status" defaultChecked={initialColorfulStatus} className="mt-0.5 h-4 w-4 rounded border-border" />
            <span>
              エラー・成功・NEWタグなどの状態表示に色を使う
              <span className="mt-0.5 block text-xs text-muted-foreground">オフの場合、これらも白黒+アクセントカラーで統一表示されます（既定はオフ）。</span>
            </span>
          </label>
        </div>
        <div className="border-t border-border pt-4">
          <h2 className="font-bold">画面遷移とタッチ操作</h2>
          <p className="mt-1 text-sm text-muted-foreground">高速な連打による二重遷移を防ぎ、待ち時間とスマホの反応を調整します。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 rounded-xl bg-secondary/35 p-3 text-sm">
              <input type="checkbox" name="navigation_lock_enabled" defaultChecked={navigationLockEnabled} className="mt-0.5 h-4 w-4 rounded border-border" />
              <span><span className="font-medium">遷移中は次の画面操作を止める</span><span className="mt-0.5 block text-xs text-muted-foreground">白画面や競合を防ぐため、通常はオンを推奨します。</span></span>
            </label>
            <label className="flex items-start gap-2 rounded-xl bg-secondary/35 p-3 text-sm">
              <input type="checkbox" name="mobile_touch_feedback_enabled" defaultChecked={mobileTouchFeedbackEnabled} className="mt-0.5 h-4 w-4 rounded border-border" />
              <span><span className="font-medium">スマホのタップ反応を表示</span><span className="mt-0.5 block text-xs text-muted-foreground">PCのホバーではなく短いアニメーションで反応します。</span></span>
            </label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5"><Label htmlFor="navigation_stall_seconds">遅延案内を出すまで</Label><Input id="navigation_stall_seconds" name="navigation_stall_seconds" type="number" min={3} max={30} defaultValue={navigationStallSeconds} className="h-11 rounded-xl" /><p className="text-xs text-muted-foreground">3〜30秒</p></div>
            <div className="grid gap-1.5"><Label htmlFor="mobile_touch_feedback_ms">タップ反応の長さ</Label><Input id="mobile_touch_feedback_ms" name="mobile_touch_feedback_ms" type="number" min={80} max={500} step={10} defaultValue={mobileTouchFeedbackMs} className="h-11 rounded-xl" /><p className="text-xs text-muted-foreground">80〜500ms</p></div>
            <div className="grid gap-1.5"><Label htmlFor="motion_level">動きの大きさ</Label><Select id="motion_level" name="motion_level" defaultValue={motionLevel}><option value="subtle">控えめ</option><option value="standard">標準</option><option value="lively">活発</option></Select><p className="text-xs text-muted-foreground">端末の「動きを減らす」が最優先です。</p></div>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <h2 className="font-bold">イベント申込の固定ボタン</h2>
          <p className="mt-1 text-sm text-muted-foreground">本文との境界を自然にぼかす範囲と、出入りの速さを調整します。</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5"><Label htmlFor="cta_blur_px">背景のぼかし</Label><Input id="cta_blur_px" name="cta_blur_px" type="number" min={0} max={32} defaultValue={ctaBlurPx} className="h-11 rounded-xl" /><p className="text-xs text-muted-foreground">0〜32px</p></div>
            <div className="grid gap-1.5"><Label htmlFor="cta_fade_height_px">フェードの高さ</Label><Input id="cta_fade_height_px" name="cta_fade_height_px" type="number" min={32} max={128} defaultValue={ctaFadeHeightPx} className="h-11 rounded-xl" /><p className="text-xs text-muted-foreground">32〜128px</p></div>
            <div className="grid gap-1.5"><Label htmlFor="cta_transition_ms">出入りの時間</Label><Input id="cta_transition_ms" name="cta_transition_ms" type="number" min={100} max={600} step={10} defaultValue={ctaTransitionMs} className="h-11 rounded-xl" /><p className="text-xs text-muted-foreground">100〜600ms</p></div>
          </div>
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div>
          <SaveButton />
        </div>
      </form>
    </div>
  );
}
