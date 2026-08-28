"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CalendarPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createResidentEvent, type ResidentEventActionResult } from "@/actions/resident-events";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_EVENT_PRESETS } from "@/lib/media-defaults";
import { cn } from "@/lib/utils";

function Submit() { const { pending } = useFormStatus(); return <Button type="submit" size="lg" className="w-full rounded-xl" disabled={pending}><CalendarPlus className="h-4 w-4" />{pending ? "募集を作成中…" : "イベントを募集する"}</Button>; }

export function ResidentEventForm({ userId }: { userId: string }) {
  const [state, action] = useFormState<ResidentEventActionResult, FormData>(createResidentEvent, undefined);
  const [imageUrl, setImageUrl] = useState<string>(DEFAULT_EVENT_PRESETS[0].url);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  async function upload(file: File) { const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }; const ext = extensions[file.type]; if (!ext) return setUploadError("JPG・PNG・WebP形式の画像を選択してください"); if (file.size > 10 * 1024 * 1024) return setUploadError("画像は10MB以下にしてください"); setUploading(true); setUploadError(null); const supabase = createClient(); const path = `${userId}/community/${crypto.randomUUID()}.${ext}`; const { error } = await supabase.storage.from("event-posters").upload(path, file, { upsert: false, contentType: file.type }); if (error) { setUploadError(error.message); setUploading(false); return; } const { data } = supabase.storage.from("event-posters").getPublicUrl(path); setImageUrl(data.publicUrl); setUploading(false); }
  return <form action={action} className="space-y-5"><input type="hidden" name="image_url" value={imageUrl} />
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div><h2 className="font-bold">どんな募集ですか？</h2><p className="mt-1 text-xs text-muted-foreground">気軽なご飯、買い物、スポーツ、街歩きなどに使えます。</p></div><div className="grid gap-1.5"><Label htmlFor="community-title">タイトル</Label><Input id="community-title" name="title" required maxLength={120} placeholder="例：今夜、一緒にご飯を食べませんか？" /></div><div className="grid gap-1.5"><Label htmlFor="community-description">詳しい内容</Label><Textarea id="community-description" name="description" rows={5} maxLength={1200} placeholder="集合場所、行きたいお店、持ち物など" /></div></section>
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><h2 className="font-bold">日時・場所</h2><div className="grid gap-1.5"><Label>開催日時</Label><DateTimePicker name="event_date" required /></div><div className="grid gap-1.5"><Label htmlFor="community-location">集合場所・行き先</Label><Input id="community-location" name="location" maxLength={200} placeholder="例：2Fラウンジ / 渋谷駅ハチ公前" /></div><div className="grid gap-1.5"><Label htmlFor="community-capacity">定員（任意）</Label><div className="relative"><Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="community-capacity" name="capacity" type="number" min={2} max={100} className="pl-9" placeholder="未入力なら定員なし" /></div></div></section>
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div><h2 className="font-bold">募集画像</h2><p className="mt-1 text-xs text-muted-foreground">写真をドロップするか、既定デザインを選べます。</p></div><ImageDropzone value={imageUrl} onFile={upload} disabled={uploading} label="写真を追加" hint="一覧と詳細の両方に自動で最適化して表示します" previewClassName="object-cover" className="aspect-[1.618/1] min-h-40" />{uploadError && <p className="text-sm text-destructive">{uploadError}</p>}<div className="grid grid-cols-4 gap-2">{DEFAULT_EVENT_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => setImageUrl(preset.url)} aria-pressed={imageUrl === preset.url} className={cn("overflow-hidden rounded-xl border-2", imageUrl === preset.url ? "border-primary ring-2 ring-primary/10" : "border-transparent")}><img src={preset.url} alt={preset.label} className="aspect-[1.618/1] w-full object-cover" /><span className="block truncate bg-secondary/40 px-1 py-1 text-[9px] font-semibold">{preset.label}</span></button>)}</div></section>
    <div className="rounded-xl bg-secondary/45 p-3 text-xs leading-relaxed text-muted-foreground">作成後は通常イベントと同じように申込・トーク・コメント・いいねを利用できます。RAは安全管理のため募集内容を確認・編集・削除できます。</div>{state?.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}<Submit />
  </form>;
}
