"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Lightbulb, LockKeyhole, MessageCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createWishQuestion } from "@/actions/wish-knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { WishQuestionRow } from "@/types/database";

export const WISH_CATEGORY_LABELS = { life: "寮生活", rules: "ルール", study: "大学・勉強", food: "食事", local: "周辺・お出かけ", other: "その他" } as const;
export const WISH_CATEGORY_LABELS_EN = { life: "Dorm life", rules: "Rules", study: "University & study", food: "Food", local: "Around the neighborhood", other: "Other" } as const;
export type WishQuestionView = WishQuestionRow & { asker_name: string | null };

export function WishKnowledgeBoard({ initialQuestions, currentName, initialAskRa = false }: { initialQuestions: WishQuestionView[]; currentName: string | null; initialAskRa?: boolean }) {
  const en = useLocale() === "en";
  const labels = en ? WISH_CATEGORY_LABELS_EN : WISH_CATEGORY_LABELS;
  const [questions, setQuestions] = useState(initialQuestions);
  const [showForm, setShowForm] = useState(initialAskRa);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<keyof typeof WISH_CATEGORY_LABELS>("life");
  const [visibility, setVisibility] = useState<"public" | "ra_only">(initialAskRa ? "ra_only" : "public");
  const [answerScope, setAnswerScope] = useState<"everyone" | "ra_only">(initialAskRa ? "ra_only" : "everyone");
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    return key ? questions.filter((question) => `${question.title} ${question.body} ${question.is_anonymous ? "" : question.asker_name ?? ""}`.toLowerCase().includes(key)) : questions;
  }, [query, questions]);

  async function submit() {
    if (inFlight.current || !title.trim() || !body.trim()) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await createWishQuestion({ title, body, category, visibility, answer_scope: visibility === "ra_only" ? "ra_only" : answerScope });
      if (result.error || !result.question) { toast.error(result.error ?? (en ? "Could not post your question." : "投稿できませんでした。")); return; }
      setQuestions((current) => [{ ...result.question!, asker_name: currentName }, ...current]);
      setTitle(""); setBody(""); setShowForm(false);
      toast.success(en ? "Question posted." : "質問を投稿しました。");
    } catch {
      toast.error(en ? "Could not post. Check your connection and try again." : "投稿できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally { inFlight.current = false; setPending(false); }
  }

  return <div className="space-y-5">
    <PendingFeedback active={pending} label={en ? "Posting your question…" : "質問を投稿しています…"} />
    <header className="rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2 text-xs font-bold text-primary"><Lightbulb aria-hidden="true" className="h-4 w-4" />{en ? "Dorm life & advice" : "寮生活・相談"}</div>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{en ? "WISH Knowledge" : "WISH知恵袋"}</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{en ? "Ask the community or send a private question to an RA. Choose who can read and answer before posting." : "みんなの経験を聞いたり、RAだけに相談したりできます。投稿前に、質問を見られる人と回答できる人を選びます。"}</p>
      <Button type="button" className="mt-4" disabled={pending} aria-expanded={showForm} aria-controls="wish-question-form" onClick={() => setShowForm((value) => !value)}><Plus aria-hidden="true" className="h-4 w-4" />{en ? "Ask a question" : "質問する"}</Button>
    </header>
    {showForm && <form id="wish-question-form" method="post" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        <div className="grid gap-1.5"><Label htmlFor="wish-title">{en ? "Title" : "タイトル"}</Label><Input id="wish-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} placeholder={en ? "Where can I pick up a delivery?" : "例：宅配便はどこで受け取れますか？"} /></div>
        <div className="grid gap-1.5"><Label htmlFor="wish-category">{en ? "Category" : "カテゴリ"}</Label><Select id="wish-category" value={category} onChange={(event) => setCategory(event.target.value as keyof typeof WISH_CATEGORY_LABELS)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div>
        <div className="grid gap-3 rounded-lg bg-secondary/40 p-3 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="wish-visibility">{en ? "Who can read" : "質問を見られる人"}</Label><Select id="wish-visibility" value={visibility} onChange={(event) => { const next = event.target.value as "public" | "ra_only"; setVisibility(next); if (next === "ra_only") setAnswerScope("ra_only"); }}><option value="public">{en ? "Everyone" : "全員"}</option><option value="ra_only">{en ? "Only you and RAs" : "投稿者本人とRAのみ"}</option></Select></div>
          <div className="grid gap-1.5"><Label htmlFor="wish-answer-scope">{en ? "Who can answer" : "回答できる人"}</Label><Select id="wish-answer-scope" value={visibility === "ra_only" ? "ra_only" : answerScope} disabled={visibility === "ra_only"} onChange={(event) => setAnswerScope(event.target.value as "everyone" | "ra_only")}><option value="everyone">{en ? "Everyone" : "全員"}</option><option value="ra_only">{en ? "RAs only" : "RAのみ"}</option></Select></div>
          <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">{visibility === "ra_only" ? en ? "This question and its replies are visible only to you and RAs. Only RAs can answer." : "質問と回答は投稿者本人とRAだけが閲覧でき、RAだけが回答できます。" : en ? "Your name, question and replies will be visible to everyone using WISH." : "投稿者名・質問・回答は、WISHを利用する全員に表示されます。"}</p>
        </div>
        <div className="grid gap-1.5"><Label htmlFor="wish-body">{en ? "Details" : "詳しい内容"}</Label><Textarea id="wish-body" value={body} onChange={(event) => setBody(event.target.value)} required rows={5} maxLength={2000} placeholder={en ? "Describe the situation and anything you have already tried." : "状況や、すでに試したことがあれば書いてください。"} /><span className="text-right text-xs text-muted-foreground">{body.length}/2000</span></div>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!title.trim() || !body.trim()}>{pending ? en ? "Posting…" : "投稿中…" : en ? "Post question" : "質問を投稿"}</Button><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>{en ? "Close" : "閉じる"}</Button></div>
      </fieldset>
    </form>}
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold">{en ? "Questions" : "質問一覧"}（{questions.length}）</h2><div className="relative w-full sm:w-72"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label={en ? "Search questions" : "質問を検索"} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Search questions" : "質問を検索"} className="pl-9" /></div></div>
      {visible.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{en ? "No questions found." : "該当する質問はありません。"}</div> : <div className="space-y-2">{visible.map((question) => <Link key={question.id} href={`/wisdom/${question.id}`} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="min-w-0 flex-1"><div className="mb-1.5 flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">{labels[question.category]}</span>{question.visibility === "ra_only" && <span className="inline-flex items-center gap-1 text-xs font-medium"><LockKeyhole aria-hidden="true" className="h-3 w-3" />{en ? "Private · RAs" : "本人・RAのみ"}</span>}{question.visibility === "public" && question.answer_scope === "ra_only" && <span className="text-xs text-muted-foreground">{en ? "RA answers only" : "RAのみ回答"}</span>}{question.accepted_answer_id && <span className="inline-flex items-center gap-1 text-xs font-medium"><CheckCircle2 aria-hidden="true" className="h-3 w-3" />{en ? "Resolved" : "解決済み"}</span>}</div><h3 className="break-words font-bold leading-snug">{question.title}</h3><p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{question.is_anonymous ? en ? "Anonymous" : "匿名" : question.asker_name ?? (en ? "Resident" : "寮生")} · {new Date(question.created_at).toLocaleDateString(en ? "en-US" : "ja-JP", { month: "short", day: "numeric", timeZone: "Asia/Tokyo" })}</p></div>
        <span aria-label={en ? `${question.answer_count} answers` : `回答${question.answer_count}件`} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground"><MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />{question.answer_count}</span><ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>)}</div>}
    </section>
  </div>;
}
