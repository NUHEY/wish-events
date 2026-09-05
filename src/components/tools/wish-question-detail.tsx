"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, LockKeyhole, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { acceptWishAnswer, createWishAnswer, deleteWishQuestion } from "@/actions/wish-knowledge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { WishAnswerRow, WishQuestionRow } from "@/types/database";
import { WISH_CATEGORY_LABELS, WISH_CATEGORY_LABELS_EN } from "@/components/tools/wish-knowledge-board";
import { useConfirm } from "@/components/ui/confirm-dialog";

export type WishAnswerView = WishAnswerRow & { answerer_name: string | null; answerer_avatar: string | null; answerer_role: "resident" | "ra" };
export type WishQuestionDetailView = WishQuestionRow & { asker_name: string | null; asker_avatar: string | null };

function Person({ name, avatar, role }: { name: string | null; avatar: string | null; role?: "resident" | "ra" }) {
  const en = useLocale() === "en";
  return <span className="flex min-w-0 items-center gap-2"><span className={cn("relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-border", role === "ra" && "ring-primary")}><Image src={avatar || DEFAULT_AVATAR_IMAGE_URL} alt="" fill sizes="32px" className="object-cover" /></span><span className="break-words text-xs font-semibold leading-relaxed">{name ?? (en ? "Resident" : "寮生")}{role === "ra" && <span className="ml-1 text-xs font-bold text-primary">RA</span>}</span></span>;
}

export function WishQuestionDetail({ question, initialAnswers, current, canModerate = false }: { question: WishQuestionDetailView; initialAnswers: WishAnswerView[]; current: { id: string; name: string | null; avatar: string | null; role: "resident" | "ra" }; canModerate?: boolean }) {
  const en = useLocale() === "en";
  const [answers, setAnswers] = useState(initialAnswers);
  const router = useRouter();
  const confirm = useConfirm();
  const [acceptedId, setAcceptedId] = useState(question.accepted_answer_id);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const isAuthor = current.id === question.asked_by;
  const isRa = current.role === "ra";
  const canAccept = isAuthor || isRa;
  const canDelete = isAuthor || isRa || (question.visibility === "public" && canModerate);
  const canAnswer = isRa || (question.visibility !== "ra_only" && question.answer_scope !== "ra_only");
  const date = (value: string) => new Date(value).toLocaleString(en ? "en-US" : "ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });

  async function update(task: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try { await task(); }
    catch { toast.error(en ? "Could not update. Check your connection and try again." : "更新できませんでした。通信状態を確認して、もう一度お試しください。"); }
    finally { inFlight.current = false; setPending(false); }
  }
  function submit() {
    if (!canAnswer || !text.trim()) return;
    void update(async () => {
      const result = await createWishAnswer(question.id, text);
      if (result.error || !result.answer) { toast.error(result.error ?? (en ? "Could not post your answer." : "回答を投稿できませんでした。")); return; }
      setAnswers((list) => [...list, { ...result.answer!, answerer_name: current.name, answerer_avatar: current.avatar, answerer_role: current.role }]);
      setText("");
      toast.success(en ? "Answer posted." : "回答を投稿しました。");
    });
  }
  function accept(answerId: string) {
    if (!canAccept) return;
    void update(async () => {
      const result = await acceptWishAnswer(question.id, answerId);
      if (result.error) toast.error(result.error);
      else { setAcceptedId(answerId); toast.success(en ? "Marked as the accepted answer." : "解決した回答に選びました。"); }
    });
  }
  async function remove() {
    if (!canDelete || inFlight.current) return;
    if (!(await confirm({ title: en ? "Delete this question?" : "質問を削除しますか？", message: en ? "All answers to this question will also be deleted." : "投稿された回答も一緒に削除されます。", confirmLabel: en ? "Delete" : "削除する", danger: true }))) return;
    void update(async () => {
      const result = await deleteWishQuestion(question.id);
      if (result.error) toast.error(result.error);
      else { toast.success(en ? "Question deleted." : "質問を削除しました。"); router.replace("/wisdom"); }
    });
  }

  const ordered = [...answers].sort((a, b) => a.id === acceptedId ? -1 : b.id === acceptedId ? 1 : new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return <div className="mx-auto max-w-3xl space-y-5">
    <PendingFeedback active={pending} label={en ? "Updating question…" : "質問・回答を更新しています…"} />
    <div className="flex flex-wrap items-center justify-between gap-2"><Link href="/wisdom" className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="h-4 w-4" />{en ? "WISH Knowledge" : "WISH知恵袋"}</Link>{canDelete && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={remove}><Trash2 aria-hidden="true" className="h-4 w-4" />{en ? "Delete" : "削除"}</Button>}</div>
    <article className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{(en ? WISH_CATEGORY_LABELS_EN : WISH_CATEGORY_LABELS)[question.category]}</span>{question.visibility === "ra_only" && <span className="inline-flex items-center gap-1 text-xs font-medium"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />{en ? "Only you and RAs" : "投稿者本人とRAのみ"}</span>}{acceptedId && <span className="inline-flex items-center gap-1 text-xs font-medium"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />{en ? "Resolved" : "解決済み"}</span>}</div>
      <h1 className="mt-3 break-words text-xl font-extrabold leading-snug sm:text-2xl">{question.title}</h1>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">{question.body}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><Person name={question.is_anonymous ? en ? "Anonymous" : "匿名" : question.asker_name} avatar={question.is_anonymous ? null : question.asker_avatar} /><time dateTime={question.created_at} className="text-xs text-muted-foreground">{date(question.created_at)}</time></div>
      {(question.visibility === "ra_only" || question.answer_scope === "ra_only") && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{question.visibility === "ra_only" ? en ? "This question and its replies are visible only to the author and RAs. Only RAs can answer." : "質問と回答は投稿者本人とRAだけが閲覧でき、RAだけが回答できます。" : en ? "Everyone can read this question. Only RAs can answer." : "全員が閲覧でき、RAだけが回答できます。"}</p>}
    </article>
    <section>
      <h2 className="mb-3 font-bold">{en ? "Answers" : "回答"}（{answers.length}）</h2>
      {ordered.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">{canAnswer ? en ? "Be the first to answer." : "最初の回答を投稿してみましょう。" : en ? "Waiting for an RA to answer." : "RAからの回答をお待ちください。"}</div> : <div className="space-y-3">{ordered.map((answer) => {
        const accepted = answer.id === acceptedId;
        return <article key={answer.id} className={cn("rounded-xl border bg-card p-4 shadow-sm", accepted ? "border-primary/40" : "border-border")}>
          <div className="flex flex-wrap items-center justify-between gap-3"><Person name={answer.answerer_name} avatar={answer.answerer_avatar} role={answer.answerer_role} />{accepted && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"><Check aria-hidden="true" className="h-3 w-3" />{en ? "Accepted answer" : "解決した回答"}</span>}</div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{answer.body}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><time dateTime={answer.created_at} className="text-xs text-muted-foreground">{date(answer.created_at)}</time>{canAccept && !accepted && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => accept(answer.id)}><CheckCircle2 aria-hidden="true" className="h-4 w-4" />{en ? "Accept answer" : "この回答で解決"}</Button>}</div>
        </article>;
      })}</div>}
    </section>
    {canAnswer && <form method="post" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); submit(); }} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <Label htmlFor="wish-answer">{en ? "Your answer" : "回答を書く"}</Label>
      <Textarea id="wish-answer" value={text} disabled={pending} onChange={(event) => setText(event.target.value)} required maxLength={2000} rows={4} placeholder={en ? "Share what you know or have experienced." : "あなたの経験や知っていることを書いてください。"} />
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{text.length}/2000</span><Button type="submit" size="sm" disabled={pending || !text.trim()}><Send aria-hidden="true" className="h-4 w-4" />{pending ? en ? "Posting…" : "投稿中…" : en ? "Post answer" : "回答を投稿"}</Button></div>
    </form>}
  </div>;
}
