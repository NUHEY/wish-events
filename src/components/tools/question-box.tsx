"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";
import { submitRaQuestion } from "@/actions/beta-tools";
import { BetaBadge } from "@/components/tools/beta-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Textarea } from "@/components/ui/textarea";

export type QuestionView = { id: string; asked_by: string; question: string; is_anonymous: boolean; answer: string | null; is_public: boolean; created_at: string; asked_name?: string | null; answered_name?: string | null };

export function QuestionBox({ questions, currentUserId }: { questions: QuestionView[]; currentUserId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, startTransition] = useTransition();
  const publicQuestions = questions.filter((question) => question.is_public && question.answer);
  const mine = questions.filter((question) => question.asked_by === currentUserId && !question.is_public);

  function submit() {
    startTransition(async () => {
      const result = await submitRaQuestion(text, anonymous);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setText("");
      setAnonymous(false);
      toast.success("RAへ質問を送りました");
      router.refresh();
    });
  }

  return <div className="mx-auto max-w-3xl space-y-6"><PendingFeedback active={pending} label="質問を送信しています…" /><header className="rounded-3xl bg-gradient-to-br from-amber-400/15 via-card to-primary/[0.07] p-5 sm:p-7"><div className="flex items-center gap-2"><BetaBadge /><span className="text-xs font-semibold text-muted-foreground">Ask your RA</span></div><h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">RAへの質問箱</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">寮生活で気になることをRAに質問できます。回答後、役立つ内容は匿名の公開Q&Aとして共有されることがあります。</p></header>
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div className="flex items-center gap-2 font-bold"><MessageCircleQuestion className="h-4 w-4 text-primary" />質問する</div><Textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={500} rows={5} placeholder="困っていること、寮のルール、生活上の疑問などを入力してください" /><div className="flex items-center justify-between gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={anonymous} onCheckedChange={(checked) => setAnonymous(checked === true)} />公開時に名前を表示しない</label><span className="text-xs text-muted-foreground">{text.length}/500</span></div><Button type="button" className="w-full rounded-xl" disabled={pending || !text.trim()} onClick={submit}><Send className="h-4 w-4" />RAへ送信</Button></section>
    {mine.length > 0 && <section><h2 className="mb-3 font-bold">回答待ち・自分だけに表示</h2><div className="space-y-2">{mine.map((question) => <article key={question.id} className="rounded-2xl border border-border bg-card p-4"><p className="text-sm font-semibold leading-relaxed">{question.question}</p><p className="mt-2 text-xs text-muted-foreground">{question.answer ? "RAが回答しました（まだ全体公開されていません）" : "RAからの回答をお待ちください"}</p>{question.answer && <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed">{question.answer}</p>}</article>)}</div></section>}
    <section><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">みんなのQ&A</h2><span className="text-xs text-muted-foreground">{publicQuestions.length}件</span></div>{publicQuestions.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">公開されたQ&Aはまだありません</div> : <div className="space-y-3">{publicQuestions.map((question) => <article key={question.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="p-4"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-extrabold text-primary">Q</span><div><p className="font-bold leading-relaxed">{question.question}</p><p className="mt-1 text-xs text-muted-foreground">{question.is_anonymous ? "匿名の寮生" : question.asked_name ?? "寮生"}</p></div></div></div><div className="border-t border-border bg-secondary/35 p-4"><div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-extrabold text-primary-foreground">A</span><div><p className="whitespace-pre-wrap text-sm leading-relaxed">{question.answer}</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"><CheckCircle2 className="h-3.5 w-3.5" />{question.answered_name ?? "RA"}</p></div></div></div></article>)}</div>}</section>
  </div>;
}
