"use client";

import { useState, useTransition } from "react";
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveRaLinkHub, type LinkHubItemInput } from "@/actions/beta-tools";
import { ShareLinkButton } from "@/components/tools/share-link-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EditorItem = LinkHubItemInput & { editorId: string };
export type LinkHubInitial = { slug: string; title: string; bio: string | null; is_published: boolean } | null;

const iconOptions = [
  ["link", "一般リンク"], ["form", "申請・フォーム"], ["instagram", "Instagram"], ["document", "資料"], ["calendar", "予定・予約"], ["contact", "連絡先"],
] as const;

export function LinkHubEditor({ initialHub, initialItems, defaultSlug, defaultTitle }: { initialHub: LinkHubInitial; initialItems: LinkHubItemInput[]; defaultSlug: string; defaultTitle: string }) {
  const [slug, setSlug] = useState(initialHub?.slug ?? defaultSlug);
  const [title, setTitle] = useState(initialHub?.title ?? defaultTitle);
  const [bio, setBio] = useState(initialHub?.bio ?? "WISHでよく使うリンクをまとめています。");
  const [published, setPublished] = useState(initialHub?.is_published ?? false);
  const [items, setItems] = useState<EditorItem[]>(() => initialItems.map((item) => ({ ...item, editorId: crypto.randomUUID() })));
  const [savedSlug, setSavedSlug] = useState(initialHub?.slug ?? null);
  const [pending, startTransition] = useTransition();

  function addItem() {
    setItems((current) => [...current, { editorId: crypto.randomUUID(), title: "", url: "https://", description: "", icon: "link", enabled: true }]);
  }

  function updateItem(editorId: string, patch: Partial<EditorItem>) {
    setItems((current) => current.map((item) => item.editorId === editorId ? { ...item, ...patch } : item));
  }

  function save() {
    startTransition(async () => {
      const result = await saveRaLinkHub({ slug, title, bio, published, items: items.map(({ editorId: _editorId, ...item }) => item) });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSavedSlug(result.slug ?? slug);
      toast.success("リンクページを保存しました");
    });
  }

  return <div className="space-y-5"><PendingFeedback active={pending} label="リンクページを保存しています…" /><section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div className="grid gap-2"><Label htmlFor="hub-title">ページタイトル</Label><Input id="hub-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={60} placeholder="例: 5F RA Links" /></div><div className="grid gap-2"><Label htmlFor="hub-bio">短い説明</Label><Textarea id="hub-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={240} rows={3} /></div><div className="grid gap-2"><Label htmlFor="hub-slug">共有URL</Label><div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring"><span className="shrink-0 pl-3 text-xs text-muted-foreground">/links/</span><input id="hub-slug" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={40} className="h-10 min-w-0 flex-1 bg-transparent px-1 text-base outline-none sm:text-sm" /></div><p className="text-xs text-muted-foreground">半角英数字とハイフン。保存後に変更すると以前のURLは開けなくなります。</p></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/55 p-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Checkbox checked={published} onCheckedChange={(checked) => setPublished(checked === true)} />寮生へ公開する</label>{savedSlug && <ShareLinkButton title={title} path={`/links/${savedSlug}`} />}</div></section>
    <section className="space-y-3"><div className="flex items-center justify-between"><div><h2 className="font-bold">掲載リンク</h2><p className="text-xs text-muted-foreground">最大30件。上から順に表示します。</p></div><Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4" />追加</Button></div>{items.length === 0 && <button type="button" onClick={addItem} className="w-full rounded-2xl border border-dashed border-border bg-card p-8 text-sm text-muted-foreground">最初のリンクを追加</button>}{items.map((item, index) => <article key={item.editorId} className="rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="flex items-center gap-1 text-xs font-bold text-muted-foreground"><GripVertical className="h-4 w-4" />LINK {index + 1}</span><button type="button" onClick={() => setItems((current) => current.filter((value) => value.editorId !== item.editorId))} className="rounded-full p-2 text-muted-foreground active:bg-destructive/10 active:text-destructive" aria-label="削除"><Trash2 className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-2"><Label>タイトル</Label><Input value={item.title} onChange={(event) => updateItem(item.editorId, { title: event.target.value })} maxLength={60} placeholder="外泊届" /></div><div className="grid gap-2"><Label>種類</Label><Select value={item.icon} onChange={(event) => updateItem(item.editorId, { icon: event.target.value as EditorItem["icon"] })}>{iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><div className="grid gap-2 sm:col-span-2"><Label>URL</Label><Input type="url" inputMode="url" value={item.url} onChange={(event) => updateItem(item.editorId, { url: event.target.value })} placeholder="https://..." /></div><div className="grid gap-2 sm:col-span-2"><Label>補足（任意）</Label><Input value={item.description ?? ""} onChange={(event) => updateItem(item.editorId, { description: event.target.value })} maxLength={120} placeholder="申請前に注意事項を確認してください" /></div><label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={item.enabled} onCheckedChange={(checked) => updateItem(item.editorId, { enabled: checked === true })} />このリンクを表示する</label></div></article>)}</section>
    <Button type="button" size="lg" className="w-full rounded-xl" disabled={pending || !title.trim() || !slug.trim()} onClick={save}><Save className="h-4 w-4" />{pending ? "保存中…" : "リンクページを保存"}</Button>
  </div>;
}
