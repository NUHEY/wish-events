import { z } from "zod";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * 実際にドアに表示されている部屋番号（例: 3階なら "301A"、11階なら "1122C"、
 * RA個室なら "1107" のようにユニット文字なし）をそのまま入力してもらい、
 * 階(floor_number)と号室(room_number)に分解する。
 *
 * 3〜9階: 1桁の階 + 2桁の号室 + 任意のユニット文字(A-D)
 * 10〜11階: 2桁の階 + 2桁の号室 + 任意のユニット文字(A-D)
 *
 * 1桁の階の候補(3-9)と2桁の階の候補(10-11)のどちらにも「1」始まりの階は
 * 存在しないため、この2パターンの間で解釈が曖昧になることはない
 * （例: "1107" は 11階07号室としてのみ解釈できる）。
 */
const FULL_ROOM_NUMBER_REGEX = /^(3|4|5|6|7|8|9|10|11)([0-9]{2})([A-D])?$/;

export type ParsedRoomNumber = {
  floorNumber: number;
  roomNumber: string;
};

export function parseFullRoomNumber(input: string): ParsedRoomNumber | null {
  const trimmed = input.trim().toUpperCase();
  const match = FULL_ROOM_NUMBER_REGEX.exec(trimmed);
  if (!match) return null;
  const floorNumber = Number(match[1]);
  const roomNumber = `${match[2]}${match[3] ?? ""}`;
  return { floorNumber, roomNumber };
}

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
      .refine((v) => parseFullRoomNumber(v) !== null, t.roomNumberFormat),
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
  });
}

export type ProfileInput = z.infer<ReturnType<typeof getProfileSchema>>;
