"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { QUESTION_TYPES, QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/constants";
import type { SurveyQuestionRow, SurveyRow } from "@/types/database";
import type { ActionResult } from "@/actions/surveys";

type DraftQuestion = {
  question_text: string;
  question_type: QuestionType;
  options: string[];
  is_required: boolean;
};

type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "保存中..." : "アンケートを保存"}
    </Button>
  );
}

function toDraft(q: SurveyQuestionRow): DraftQuestion {
  return {
    question_text: q.question_text,
    question_type: q.question_type,
    options: q.options ?? [],
    is_required: q.is_required,
  };
}

export function SurveyBuilder({
  action,
  initialSurvey,
  initialQuestions,
}: {
  action: FormAction;
  initialSurvey?: SurveyRow;
  initialQuestions?: SurveyQuestionRow[];
}) {
  const [state, formAction] = useFormState<ActionResult, FormData>(action, undefined);
  const [title, setTitle] = useState(initialSurvey?.title ?? "イベント後アンケート");
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

      <div className="grid gap-2 sm:w-2/3">
        <Label htmlFor="survey_title">アンケートのタイトル</Label>
        <Input id="survey_title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">質問 {index + 1}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(index)}>
                削除
              </Button>
            </div>
            <Input
              placeholder="質問文を入力"
              value={q.question_text}
              onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                value={q.question_type}
                onChange={(e) =>
                  updateQuestion(index, { question_type: e.target.value as QuestionType })
                }
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={q.is_required}
                  onCheckedChange={(checked) =>
                    updateQuestion(index, { is_required: checked === true })
                  }
                />
                回答必須
              </label>
            </div>
            {(q.question_type === "single_choice" || q.question_type === "multiple_choice") && (
              <div className="grid gap-2">
                <Label>選択肢（カンマ区切り）</Label>
                <Input
                  placeholder="例: とても良かった, 良かった, ふつう, いまいち"
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
        + 質問を追加
      </Button>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
