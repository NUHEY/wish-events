"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, ChevronRight, Lightbulb, MessageCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createWishQuestion } from "@/actions/wish-knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { WishQuestionRow } from "@/types/database";

export const WISH_CATEGORY_LABELS = { life: "寮生活", rules: "ルール", study: "大学・勉強", food: "食事", local: "周辺・お出かけ", other: "その他" } as const;
export type WishQuestionView = WishQuestionRow & { asker_name: string | null };

export function WishKnowledgeBoard({ initialQuestions, currentName }: { initialQuestions: WishQuestionView[]; currentName: string | null }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<keyof typeof WISH_CATEGORY_LABELS>("life");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => { const key = query.trim().toLowerCase(); return key ? questions.filter((question) => `${question.title} ${question.body} ${question.asker_name ?? ""}`.toLowerCase().includes(key)) : questions; }, [query, questions]);

  function submit() {
    startTransition(async () => {
      const result = await createWishQuestion({ title, body, category });
      if (result.error || !result.question) { toast.error(result.error ?? "投稿できませんでした"); return; }
      setQuestions((current) => [{ ...result.question!, asker_name: currentName }, ...current]);
      setTitle(""); setBody(""); setShowForm(false);
      toast.success("質問を投稿しました");
    });
  }

  return <div className="space-y-5"><PendingFeedback active={pending} label="質問を投稿しています…" />
    <header className="rounded-3xl bg-gradient-to-br from-amber-400/15 via-card to-lime-300/10 p-5 sm:p-7"><div className="flex items-center gap-2 text-xs font-bold text-primary"><Lightbulb className="h-4 w-4" />Resident knowledge</div><h1 className="mt-3 text-3xl font-extrabold tracking-tight">WISH知恵袋</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">寮生活で分からないことを質問して、WISHのみんなの経験から答えを見つけます。</p><Button type="button" className="mt-4 rounded-xl" onClick={() => setShowForm((value) => !value)}><Plus className="h-4 w-4" />質問する</Button></header>
    {showForm && <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div className="grid gap-1.5"><Label>タイトル</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="例：宅配便はどこで受け取れますか？" /></div><div className="grid gap-1.5"><Label>カテゴリ</Label><Select value={category} onChange={(event) => setCategory(event.target.value as keyof typeof WISH_CATEGORY_LABELS)}>{Object.entries(WISH_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><div className="grid gap-1.5"><Label>詳しい内容</Label><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} maxLength={2000} placeholder="状況や、すでに試したことがあれば書いてください" /><span className="text-right text-xs text-muted-foreground">{body.length}/2000</span></div><div className="flex gap-2"><Button type="button" disabled={pending || !title.trim() || !body.trim()} onClick={submit}>投稿する</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>閉じる</Button></div></section>}
    <section><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">みんなの質問（{questions.length}）</h2><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="質問を検索" className="rounded-full pl-9" /></div></div>
      {visible.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">該当する質問はありません</div> : <div className="space-y-2">{visible.map((question) => <Link key={question.id} href={`/wisdom/${question.id}`} className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-transform active:scale-[0.99]"><div className="min-w-0 flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{WISH_CATEGORY_LABELS[question.category]}</span>{question.accepted_answer_id && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success"><CheckCircle2 className="h-3 w-3" />解決済み</span>}</div><h3 className="line-clamp-2 font-bold leading-snug">{question.title}</h3><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{question.asker_name ?? "寮生"}・{new Date(question.created_at).toLocaleDateString("ja-JP", { month: "short", day: "numeric" })}</p></div><span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" />{question.answer_count}</span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div>}
    </section>
  </div>;
}
