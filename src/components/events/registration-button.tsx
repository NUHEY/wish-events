"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  registerForEvent,
  registerForEventWithAnswers,
  cancelRegistration,
} from "@/actions/registrations";
import { formatEventDateTime } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { RegistrationQuestionRow } from "@/types/database";

type Answers = Record<string, string | string[]>;

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: RegistrationQuestionRow;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  if (question.question_type === "single_choice") {
    return (
      <div className="flex flex-col gap-1.5">
        {(question.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={question.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="h-4 w-4 accent-primary"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (question.question_type === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-col gap-1.5">
        {(question.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={(checked) =>
                onChange(
                  checked === true ? [...selected, opt] : selected.filter((o) => o !== opt)
                )
              }
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  return (
    <Input
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function RegistrationButton({
  eventId,
  isRegistered,
  isFull,
  questions = [],
  registrationOpensAt = null,
  registrationClosesAt = null,
}: {
  eventId: string;
  isRegistered: boolean;
  isFull: boolean;
  questions?: RegistrationQuestionRow[];
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const router = useRouter();
  const dict = useDict();
  const locale = useLocale();

  const registrationOpen = !registrationOpensAt || new Date(registrationOpensAt).getTime() <= Date.now();
  const registrationClosed = !!registrationClosesAt && new Date(registrationClosesAt).getTime() < Date.now();
  const requiresAnswers = questions.length > 0;

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelRegistration(eventId);
      if (result?.error) setError(result.error);
      else {
        toast.success(dict.toast.cancelled);
        router.refresh();
      }
    });
  }

  function handleSimpleRegister() {
    setError(null);
    startTransition(async () => {
      const result = await registerForEvent(eventId);
      if (result?.error) setError(result.error);
      else {
        toast.success(dict.toast.registered);
        router.push(result.talkHref ?? `/talks/${eventId}?joined=1`);
      }
    });
  }

  function handleAnswerSubmit() {
    setError(null);
    for (const q of questions) {
      const v = answers[q.id];
      const isEmpty = !v || (Array.isArray(v) && v.length === 0);
      if (q.is_required && isEmpty) {
        setError(`${q.question_text}${dict.surveys.requiredError}`);
        return;
      }
    }

    startTransition(async () => {
      const payload = questions.map((q) => {
        const v = answers[q.id];
        return Array.isArray(v)
          ? { question_id: q.id, answer_options: v }
          : { question_id: q.id, answer_text: v ?? "" };
      });
      const result = await registerForEventWithAnswers(eventId, payload);
      if (result?.error) setError(result.error);
      else {
        toast.success(dict.toast.registered);
        setExpanded(false);
        router.push(result.talkHref ?? `/talks/${eventId}?joined=1`);
      }
    });
  }

  if (isRegistered) {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={handleCancel} disabled={pending} variant="outline" className="w-full sm:w-auto">
          {pending ? dict.event.processing : dict.event.cancelRegistration}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button disabled className="w-full sm:w-auto">
          {dict.event.register}
        </Button>
        <p className="text-xs text-muted-foreground">
          {dict.event.registrationNotYetOpenPrefix} {formatEventDateTime(registrationOpensAt!, locale)}
          {dict.event.registrationNotYetOpenSuffix}
        </p>
      </div>
    );
  }

  if (registrationClosed) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button disabled className="w-full sm:w-auto">
          {dict.event.register}
        </Button>
        <p className="text-xs text-muted-foreground">{dict.event.registrationClosedMessage}</p>
      </div>
    );
  }

  if (!requiresAnswers) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSimpleRegister}
          disabled={pending || isFull}
          className="w-full sm:w-auto"
        >
          {pending ? dict.event.processing : isFull ? dict.event.full : dict.event.register}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          onClick={() => setExpanded(true)}
          disabled={pending || isFull}
          className="w-full sm:w-auto"
        >
          {isFull ? dict.event.full : dict.event.register}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-secondary/30 p-4">
      <p className="text-sm font-medium">{dict.registrationQuestions.answerFormTitle}</p>
      {questions.map((q) => (
        <div key={q.id} className="grid gap-1.5">
          <label className="text-sm">
            {q.question_text}
            {q.is_required && <span className="ml-1 text-destructive">*</span>}
          </label>
          <QuestionField
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
          />
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={handleAnswerSubmit} disabled={pending}>
          {pending ? dict.event.processing : dict.registrationQuestions.submitButton}
        </Button>
        <Button variant="ghost" onClick={() => setExpanded(false)} disabled={pending}>
          {dict.registrationQuestions.cancelButton}
        </Button>
      </div>
    </div>
  );
}
