import { z } from "zod";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { parseFullRoomNumber } from "@/lib/utils";

const INSTAGRAM_REGEX = /^[A-Za-z0-9._]{1,30}$/;

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
  });
}

export type ProfileInput = z.infer<ReturnType<typeof getProfileSchema>>;
