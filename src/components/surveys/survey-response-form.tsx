"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { submitSurveyResponse, type AnswerInput } from "@/actions/surveys";
import { useDict } from "@/lib/i18n/locale-provider";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";
import { useDirtyForm } from "@/lib/hooks/use-dirty-form";
import type { SurveyQuestionRow } from "@/types/database";

export function SurveyResponseForm({
  surveyId,
  eventId,
  questions,
}: {
  surveyId: string;
  eventId: string;
  questions: SurveyQuestionRow[];
}) {
  const dict = useDict();
  const sorted = [...questions].sort((a, b) => a.position - b.position);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const { formRef, isDirty, markDirty, reset } = useDirtyForm();

  useUnsavedChangesGuard(isDirty && !done, dict.common.unsavedChangesConfirm);

  function setText(questionId: string, value: string) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    markDirty();
  }

  function toggleOption(questionId: string, option: string, multi: boolean) {
    setAnswers((a) => {
      if (multi) {
        const current = (a[questionId] as string[] | undefined) ?? [];
        const next = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...a, [questionId]: next };
      }
      return { ...a, [questionId]: option };
    });
    markDirty();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const missing = sorted.find((q) => {
      if (!q.is_required) return false;
      const v = answers[q.id];
      return !v || (Array.isArray(v) && v.length === 0);
    });
    if (missing) {
      setError(`「${missing.question_text}」${dict.surveys.requiredError}`);
      return;
    }

    const payload: AnswerInput[] = sorted.map((q) => {
      const v = answers[q.id];
      if (Array.isArray(v)) return { question_id: q.id, answer_options: v };
      return { question_id: q.id, answer_text: v };
    });

    reset();
    startTransition(async () => {
      const result = await submitSurveyResponse(surveyId, payload);
      if (result.error) {
        markDirty();
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(dict.toast.registered);
        setDone(true);
        router.replace(`/events/${eventId}?survey=completed`);
      }
    });
  }

  if (done) {
    return <p className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center text-sm font-medium text-primary">{dict.surveys.thanks}</p>;
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onInput={markDirty} onChange={markDirty} className="flex flex-col gap-6">
      {sorted.map((q, index) => (
        <div key={q.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Label>
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>{q.question_text}
            {q.is_required && <span className="ml-1 text-destructive">*</span>}
          </Label>

          {q.question_type === "text" && (
            <Textarea
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setText(q.id, e.target.value)}
            />
          )}

          {q.question_type === "rating" && (
            <div className="grid grid-cols-5 gap-2">
              {["1", "2", "3", "4", "5"].map((n) => (
                <label key={n} className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2 text-sm transition-colors ${answers[q.id] === n ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"}`}>
                  <input
                    type="radio"
                    name={`rating-${q.id}`}
                    checked={answers[q.id] === n}
                    onChange={() => setText(q.id, n)}
                  />
                  {n}
                </label>
              ))}
            </div>
          )}

          {q.question_type === "single_choice" &&
            (q.options ?? []).map((opt) => (
              <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${answers[q.id] === opt ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                <input
                  type="radio"
                  name={`choice-${q.id}`}
                  checked={answers[q.id] === opt}
                  onChange={() => toggleOption(q.id, opt, false)}
                />
                {opt}
              </label>
            ))}

          {q.question_type === "multiple_choice" &&
            (q.options ?? []).map((opt) => (
              <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${((answers[q.id] as string[]) ?? []).includes(opt) ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"}`}>
                <Checkbox
                  checked={((answers[q.id] as string[]) ?? []).includes(opt)}
                  onCheckedChange={() => toggleOption(q.id, opt, true)}
                />
                {opt}
              </label>
            ))}
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? dict.surveys.submitting : dict.surveys.submitButton}
      </Button>
    </form>
  );
}
