"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { answerRaQuestion } from "@/actions/beta-tools";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionView } from "@/components/tools/question-box";
import { formatRoomNumber } from "@/lib/utils";

export function QuestionManager({ questions }: { questions: (QuestionView & { floor_number: number | null; room_number?: string | null })[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(questions.map((question) => [question.id, question.answer ?? ""])));
  const [publish, setPublish] = useState<Record<string, boolean>>(() => Object.fromEntries(questions.map((question) => [question.id, question.is_public])));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await answerRaQuestion(id, answers[id] ?? "", publish[id] ?? false);
      if (result.error) toast.error(result.error); else toast.success(publish[id] ? "回答を公開しました" : "回答を本人向けに保存しました");
      setPendingId(null);
    });
  }

  return <div className="space-y-4"><PendingFeedback active={pending} label="回答を保存しています…" />{questions.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><p className="font-bold">質問はまだありません</p><p className="mt-1 text-sm text-muted-foreground">寮生から届くとここに表示されます。</p></div> : questions.map((question) => <article key={question.id} className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{question.answer ? "回答済み" : "未回答"}</span>{question.is_public ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300"><Eye className="h-3.5 w-3.5" />公開中</span> : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><EyeOff className="h-3.5 w-3.5" />非公開</span>}</div><p className="mt-3 font-bold leading-relaxed">{question.question}</p><p className="mt-1 text-xs text-muted-foreground">{question.is_anonymous ? "匿名希望" : question.asked_name ?? "名前未登録"} · {formatRoomNumber(question.floor_number, question.room_number ?? null)}</p></div><time className="shrink-0 text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(question.created_at))}</time></div><Textarea className="mt-4" rows={4} maxLength={1200} value={answers[question.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="RAとして回答を入力" /><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={publish[question.id] ?? false} onCheckedChange={(checked) => setPublish((current) => ({ ...current, [question.id]: checked === true }))} />全寮生向けQ&Aに公開する</label><Button type="button" disabled={pending || !(answers[question.id] ?? "").trim()} onClick={() => save(question.id)}><Send className="h-4 w-4" />{pendingId === question.id ? "保存中…" : "回答を保存"}</Button></div></article>)}</div>;
}
