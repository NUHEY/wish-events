import { z } from "zod";
import { REGISTRATION_QUESTION_TYPES } from "@/lib/constants";

export const registrationQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  question_text: z.string().trim().min(1, "質問文を入力してください").max(300, "質問文は300文字以内で入力してください"),
  question_type: z.enum(REGISTRATION_QUESTION_TYPES),
  options: z.array(z.string().trim().min(1).max(120)).max(20).optional().default([]),
  is_required: z.boolean().default(true),
}).superRefine((question, context) => {
  if ((question.question_type === "single_choice" || question.question_type === "multiple_choice") && question.options.length < 2) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "選択式の質問には選択肢を2件以上設定してください" });
  }
});

export type RegistrationQuestionInput = z.infer<typeof registrationQuestionSchema>;

// 質問数0は「事前質問なし（申込は即時ボタンのみ）」として有効な状態として許可する。
// （0件で保存するとevents.registration_requires_answersはfalseに戻る。actions側参照）
export const registrationQuestionsSchema = z.object({
  questions: z.array(registrationQuestionSchema).max(20, "質問は20件以内で設定してください").optional().default([]),
});

export type RegistrationQuestionsInput = z.infer<typeof registrationQuestionsSchema>;
