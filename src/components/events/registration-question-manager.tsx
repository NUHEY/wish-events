"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { REGISTRATION_QUESTION_TYPES, type RegistrationQuestionType } from "@/lib/constants";
import type { RegistrationQuestionRow } from "@/types/database";
import type { ActionResult } from "@/actions/registration-questions";
import { useDict } from "@/lib/i18n/locale-provider";

type DraftQuestion = {
  question_text: string;
  question_type: RegistrationQuestionType;
  options: string[];
  is_required: boolean;
};

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

function SubmitButton() {
  const { pending } = useFormStatus();
  const dict = useDict();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? dict.surveys.saving : dict.registrationQuestions.saveButton}
    </Button>
  );
}

function toDraft(q: RegistrationQuestionRow): DraftQuestion {
  return {
    question_text: q.question_text,
    question_type: q.question_type as RegistrationQuestionType,
    options: q.options ?? [],
    is_required: q.is_required,
  };
}

export function RegistrationQuestionManager({
  action,
  initialQuestions,
}: {
  action: FormAction;
  initialQuestions?: RegistrationQuestionRow[];
}) {
  const dict = useDict();
  const [state, formAction] = useFormState<ActionResult, FormData>(action, undefined);
  const [questions, setQuestions] = useState<DraftQuestion[]>(
    initialQuestions?.length
      ? initialQuestions.sort((a, b) => a.position - b.position).map(toDraft)
      : [{ question_text: "", question_type: "text", options: [], is_required: true }]
  );

  function updateQuestion(index: number, patch: Partial<DraftQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { question_text: "", question_type: "text", options: [], is_required: true },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions((qs) => qs.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="questions_json" value={JSON.stringify(questions)} />

      <p className="text-sm text-muted-foreground">{dict.registrationQuestions.intro}</p>

      <div className="flex flex-col gap-4">
        {questions.map((q, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {dict.surveys.questionLabel} {index + 1}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(index)}>
                {dict.surveys.removeQuestion}
              </Button>
            </div>
            <Input
              placeholder={dict.surveys.questionPlaceholder}
              value={q.question_text}
              onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={q.question_type}
                onChange={(e) =>
                  updateQuestion(index, { question_type: e.target.value as RegistrationQuestionType })
                }
              >
                {REGISTRATION_QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {dict.surveys.questionTypes[t]}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={q.is_required}
                  onCheckedChange={(checked) => updateQuestion(index, { is_required: checked === true })}
                />
                {dict.surveys.requiredLabel}
              </label>
            </div>
            {(q.question_type === "single_choice" || q.question_type === "multiple_choice") && (
              <div className="grid gap-2">
                <Label>{dict.surveys.optionsLabel}</Label>
                <Input
                  placeholder={dict.surveys.optionsPlaceholder}
                  value={q.options.join(", ")}
                  onChange={(e) =>
                    updateQuestion(index, {
                      options: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addQuestion} className="w-fit">
        {dict.surveys.addQuestion}
      </Button>

      <p className="text-xs text-muted-foreground">{dict.registrationQuestions.emptyHint}</p>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
