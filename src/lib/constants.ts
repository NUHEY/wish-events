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

/**
 * 申込前の事前質問（アレルギー等）で使える質問形式。
 * イベント後アンケート(QUESTION_TYPES)と異なり「評価(rating)」は対象外。
 */
export const REGISTRATION_QUESTION_TYPES = [
  "text",
  "single_choice",
  "multiple_choice",
] as const;
export type RegistrationQuestionType = (typeof REGISTRATION_QUESTION_TYPES)[number];

/**
 * RA活動（イベント企画・フロア対応など）に役立てるための任意プロフィール項目。
 * いずれも未選択のまま保存可能（＝回答しない）。
 */
export const FACULTIES = [
  "政治経済学部",
  "法学部",
  "教育学部",
  "商学部",
  "基幹理工学部",
  "創造理工学部",
  "先進理工学部",
  "社会科学部",
  "人間科学部",
  "スポーツ科学部",
  "国際教養学部(SILS)",
  "文化構想学部",
  "文学部",
  "大学院",
  "別科日本語専修課程",
  "その他",
] as const;

/**
 * ホーム画面（ポータル）のセクション設定。RAが表示/非表示・並び順・
 * アクセントカラー・タイトルをカスタマイズできる（home_layout_sectionsテーブル）。
 */
export const HOME_SECTION_KEYS = ["week_events", "floor_events", "announcements"] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const HOME_ACCENT_KEYS = ["wine", "gold", "teal", "forest"] as const;
export type HomeAccentKeyValue = (typeof HOME_ACCENT_KEYS)[number];

export const HOME_ACCENT_HEX: Record<HomeAccentKeyValue, string> = {
  wine: "#7A2140",
  gold: "#C79A3B",
  teal: "#0E8074",
  forest: "#2F6B4F",
};

export const GRADE_LEVELS = [
  "学部1年",
  "学部2年",
  "学部3年",
  "学部4年以上",
  "修士課程",
  "博士課程",
  "交換留学生",
  "研究生",
  "その他",
] as const;
