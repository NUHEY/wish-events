import { z } from "zod";
import { QUESTION_TYPES } from "@/lib/constants";

export const surveyQuestionSchema = z.object({
  question_text: z.string().trim().min(1, "質問文を入力してください"),
  question_type: z.enum(QUESTION_TYPES),
  options: z.array(z.string().trim().min(1)).optional().default([]),
  is_required: z.boolean().default(true),
});

export type SurveyQuestionInput = z.infer<typeof surveyQuestionSchema>;

export const surveySchema = z.object({
  title: z.string().trim().min(1, "アンケートのタイトルを入力してください"),
  questions: z
    .array(surveyQuestionSchema)
    .min(1, "質問を1つ以上追加してください"),
});

export type SurveyInput = z.infer<typeof surveySchema>;
