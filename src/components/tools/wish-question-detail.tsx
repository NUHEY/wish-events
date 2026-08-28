"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, CheckCircle2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { acceptWishAnswer, createWishAnswer, deleteWishQuestion } from "@/actions/wish-knowledge";
import { Button } from "@/components/ui/button";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { cn } from "@/lib/utils";
import type { WishAnswerRow, WishQuestionRow } from "@/types/database";
import { WISH_CATEGORY_LABELS } from "@/components/tools/wish-knowledge-board";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type WishAnswerView = WishAnswerRow & { answerer_name: string | null; answerer_avatar: string | null; answerer_role: "resident" | "ra" };
export type WishQuestionDetailView = WishQuestionRow & { asker_name: string | null; asker_avatar: string | null };

function Person({ name, avatar, role }: { name: string | null; avatar: string | null; role?: "resident" | "ra" }) {
  return <span className="flex items-center gap-2"><span className={cn("relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-border", role === "ra" && "ring-primary")}><Image src={avatar || DEFAULT_AVATAR_IMAGE_URL} alt="" fill sizes="32px" className="object-cover" /></span><span className="text-xs font-semibold">{name ?? "寮生"}{role === "ra" && <span className="ml-1 text-[9px] font-black text-primary">RA</span>}</span></span>;
}

export function WishQuestionDetail({ question, initialAnswers, current }: { question: WishQuestionDetailView; initialAnswers: WishAnswerView[]; current: { id: string; name: string | null; avatar: string | null; role: "resident" | "ra" } }) {
  const [answers, setAnswers] = useState(initialAnswers);
  const router = useRouter();
  const confirm = useConfirm();
  const [acceptedId, setAcceptedId] = useState(question.accepted_answer_id);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const canAccept = current.id === question.asked_by || current.role === "ra";

  function submit() { startTransition(async () => { const result = await createWishAnswer(question.id, text); if (result.error || !result.answer) { toast.error(result.error ?? "回答できませんでした"); return; } setAnswers((list) => [...list, { ...result.answer!, answerer_name: current.name, answerer_avatar: current.avatar, answerer_role: current.role }]); setText(""); toast.success("回答を投稿しました"); }); }
  function accept(answerId: string) { const previous = acceptedId; setAcceptedId(answerId); startTransition(async () => { const result = await acceptWishAnswer(question.id, answerId); if (result.error) { setAcceptedId(previous); toast.error(result.error); } else toast.success("解決した回答に選びました"); }); }

  const ordered = [...answers].sort((a, b) => a.id === acceptedId ? -1 : b.id === acceptedId ? 1 : new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return <div className="mx-auto max-w-3xl space-y-5"><PendingFeedback active={pending} label="回答を更新しています…" />
    <div className="flex items-center justify-between gap-3"><Link href="/wisdom" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" />WISH知恵袋</Link>{(current.id === question.asked_by || current.role === "ra") && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={async () => { if (!(await confirm({ title: "質問を削除しますか？", message: "投稿された回答も一緒に削除されます。", confirmLabel: "削除する", danger: true }))) return; startTransition(async () => { const result = await deleteWishQuestion(question.id); if (result.error) toast.error(result.error); else { toast.success("質問を削除しました"); router.replace("/wisdom"); } }); }}><Trash2 className="h-4 w-4" />削除</Button>}</div>
    <article className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-7"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{WISH_CATEGORY_LABELS[question.category]}</span>{acceptedId && <span className="inline-flex items-center gap-1 text-xs font-bold text-success"><CheckCircle2 className="h-3.5 w-3.5" />解決済み</span>}</div><h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{question.title}</h1><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">{question.body}</p><div className="mt-5 flex items-center justify-between border-t border-border pt-4"><Person name={question.asker_name} avatar={question.asker_avatar} /><span className="text-xs text-muted-foreground">{new Date(question.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div></article>
    <section><h2 className="mb-3 font-bold">回答（{answers.length}）</h2>{ordered.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">最初の回答を投稿してみましょう</div> : <div className="space-y-3">{ordered.map((answer) => { const accepted = answer.id === acceptedId; return <article key={answer.id} className={cn("rounded-2xl border bg-card p-4 shadow-sm", accepted ? "border-success/40 ring-2 ring-success/10" : "border-border")}><div className="flex items-center justify-between gap-3"><Person name={answer.answerer_name} avatar={answer.answerer_avatar} role={answer.answerer_role} />{accepted && <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success"><Check className="h-3 w-3" />解決した回答</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7">{answer.body}</p><div className="mt-3 flex items-center justify-between"><span className="text-[11px] text-muted-foreground">{new Date(answer.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>{canAccept && !accepted && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => accept(answer.id)}><CheckCircle2 className="h-4 w-4" />この回答で解決</Button>}</div></article>; })}</div>}</section>
    <section className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 rounded-2xl border border-border bg-card/95 p-3 shadow-elevated backdrop-blur sm:static sm:p-4"><Textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={3} placeholder="あなたの経験や知っていることを回答する" className="min-h-20 resize-none border-0 bg-secondary/50 focus-visible:ring-1" /><div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">{text.length}/2000</span><Button type="button" size="sm" className="rounded-full" disabled={pending || !text.trim()} onClick={submit}><Send className="h-4 w-4" />回答する</Button></div></section>
  </div>;
}
