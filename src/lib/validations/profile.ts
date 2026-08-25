import { z } from "zod";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { parseFullRoomNumber } from "@/lib/utils";
import { PROFILE_ACCENT_KEYS } from "@/lib/constants";

const INSTAGRAM_REGEX = /^[A-Za-z0-9._]{1,30}$/;
const X_HANDLE_REGEX = /^[A-Za-z0-9_]{1,15}$/;
const LINE_ID_REGEX = /^[A-Za-z0-9._-]{1,40}$/;

/** 空文字は「未選択（回答しない）」としてNULL扱いにする任意項目用ヘルパー */
const optionalSelect = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null));

/** 複数選択（チップ+隠しinput）から届く値の配列。空要素は除去する。 */
const optionalArray = () =>
  z
    .array(z.string().trim().min(1))
    .optional()
    .default([]);

/**
 * バリデーションメッセージは表示ロケールに合わせて出し分ける。
 * Server Action側で `getLocale()` の結果を渡して呼び出す。
 *
 * 部屋番号は「1001A」のようにドアの表示そのまま（階込み）を1つの入力欄で
 * 受け取り、ここで parseFullRoomNumber により floor_number/room_number に
 * 分解する。DB上は引き続き両者を別カラムで保持する（表示・検索・RA個室判定
 * のロジックは変更していないため）が、ユーザーからは階を意識せず普段呼んで
 * いる部屋番号をそのまま入力してもらう。
 */
export function getProfileSchema(locale: Locale) {
  const t = dictionaries[locale].validation;

  return z.object({
    full_name: z
      .string()
      .trim()
      .min(1, t.fullNameRequired)
      .max(100, t.fullNameTooLong),
    student_id: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{8}$/, t.studentIdFormat),
    room_number: z
      .string()
      .trim()
      .min(1, t.roomNumberRequired)
      .transform((v) => v.toUpperCase().replace(/\s+/g, ""))
      .refine((v) => parseFullRoomNumber(v) !== null, t.roomNumberFormat)
      .transform((v) => parseFullRoomNumber(v)!),
    faculty: optionalSelect(),
    grade_level: optionalSelect(),
    languages: optionalArray(),
    nationalities: optionalArray(),
    lived_countries: optionalArray(),
    instagram_handle: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/^@/, "") : null))
      .refine((v) => v === null || INSTAGRAM_REGEX.test(v), t.instagramFormat),
    self_intro: z
      .string()
      .trim()
      .max(500, t.selfIntroTooLong)
      .optional()
      .transform((v) => (v ? v : null)),
    line_id: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || LINE_ID_REGEX.test(v), t.lineIdFormat),
    x_handle: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/^@/, "") : null))
      .refine((v) => v === null || X_HANDLE_REGEX.test(v), t.xHandleFormat),
    /** マイページの背景に使うアクセントカラー。自由に最大5つまで選べる（0個=未選択も可）。 */
    profile_accents: z
      .array(z.string().trim().min(1))
      .optional()
      .default([])
      .transform((arr) => Array.from(new Set(arr)))
      .refine(
        (arr) => arr.every((v) => (PROFILE_ACCENT_KEYS as readonly string[]).includes(v)),
        t.profileAccentInvalid
      )
      .refine((arr) => arr.length <= 5, t.profileAccentTooMany),
  });
}

export type ProfileInput = z.infer<ReturnType<typeof getProfileSchema>>;
