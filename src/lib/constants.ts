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
export const HOME_SECTION_KEYS = [
  "week_events",
  "floor_events",
  "announcements",
  "featured_events",
  "popular_events",
  "friends_events",
] as const;
export type HomeSectionKey = (typeof HOME_SECTION_KEYS)[number];

export const HOME_ACCENT_KEYS = ["wine", "gold", "teal", "forest"] as const;
export type HomeAccentKeyValue = (typeof HOME_ACCENT_KEYS)[number];

export const HOME_ACCENT_HEX: Record<HomeAccentKeyValue, string> = {
  wine: "#7A2140",
  gold: "#C79A3B",
  teal: "#0E8074",
  forest: "#2F6B4F",
};

/**
 * マイページ（寮生ディレクトリの個人プロフィール画面）の「デコ」用アクセント
 * カラー。ホーム画面カスタマイズ用のHOME_ACCENT_*とは別の、個人が選ぶための
 * パレット（8色）。未選択の場合はnull（デフォルトの見た目のまま）。
 */
export const PROFILE_ACCENT_KEYS = [
  "wine",
  "gold",
  "teal",
  "forest",
  "sakura",
  "sky",
  "sunset",
  "plum",
] as const;
export type ProfileAccentKey = (typeof PROFILE_ACCENT_KEYS)[number];

export const PROFILE_ACCENT_HEX: Record<ProfileAccentKey, string> = {
  wine: "#7A2140",
  gold: "#C79A3B",
  teal: "#0E8074",
  forest: "#2F6B4F",
  sakura: "#E58FA6",
  sky: "#3E8FD0",
  sunset: "#E0793C",
  plum: "#7C5CB5",
};

/**
 * アイコン周りの装飾リング（ゲーム要素）。
 * RAは常にワインレッド、一般寮生はイベント参加数がこの数を超えると金色になる。
 */
export const AVATAR_RING_GOLD_HEX = "#D4AF37";
export const AVATAR_RING_RA_HEX = "#7A2140";
export const AVATAR_RING_GOLD_THRESHOLD = 8;

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
