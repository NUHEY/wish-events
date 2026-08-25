import { z } from "zod";
import { REGISTRATION_QUESTION_TYPES } from "@/lib/constants";

export const registrationQuestionSchema = z.object({
  question_text: z.string().trim().min(1, "質問文を入力してください"),
  question_type: z.enum(REGISTRATION_QUESTION_TYPES),
  options: z.array(z.string().trim().min(1)).optional().default([]),
  is_required: z.boolean().default(true),
});

export type RegistrationQuestionInput = z.infer<typeof registrationQuestionSchema>;

// 質問数0は「事前質問なし（申込は即時ボタンのみ）」として有効な状態として許可する。
// （0件で保存するとevents.registration_requires_answersはfalseに戻る。actions側参照）
export const registrationQuestionsSchema = z.object({
  questions: z.array(registrationQuestionSchema).optional().default([]),
});

export type RegistrationQuestionsInput = z.infer<typeof registrationQuestionsSchema>;
