import { z } from "zod";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { FLOORS } from "@/lib/constants";

const ROOM_NUMBER_REGEX = /^[0-9]{2}[A-D]?$/;

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
 * 部屋番号は「階」と「号室（ユニット記号含む・階を含まない）」を別入力にしている。
 * ドアの表示（例: 3階なら301A）から自分でパースして入力してもらう方式は
 * 使い方が分かりにくいという指摘を受け、RA個室一覧の登録フォームと同じ
 * 「階のプルダウン + 号室の入力欄」という分離した形式に統一した。
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
    floor_number: z.coerce
      .number()
      .int()
      .refine((v) => (FLOORS as readonly number[]).includes(v), t.floorRequired),
    room_number: z
      .string()
      .trim()
      .min(1, t.roomNumberRequired)
      .transform((v) => v.toUpperCase())
      .refine((v) => ROOM_NUMBER_REGEX.test(v), t.roomNumberFormat),
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
