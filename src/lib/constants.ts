export const EVENT_CATEGORIES = [
  "RR",
  "SI",
  "公式イベント",
  "フロアイベント",
  "サポーター募集",
  "その他",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** WISHの居住階（3〜11階） */
export const FLOORS = [3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

export const SURVEY_TYPES = ["none", "external", "internal"] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const QUESTION_TYPES = [
  "text",
  "single_choice",
  "multiple_choice",
  "rating",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "自由記述",
  single_choice: "単一選択",
  multiple_choice: "複数選択",
  rating: "評価（1〜5）",
};
