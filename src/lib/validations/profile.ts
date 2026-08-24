import { z } from "zod";
import { FLOORS } from "@/lib/constants";

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "氏名を入力してください")
    .max(100, "氏名が長すぎます"),
  student_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{8}$/, "学籍番号は英数字8桁で入力してください"),
  floor_number: z.coerce
    .number()
    .refine(
      (v) => (FLOORS as readonly number[]).includes(v),
      "3〜11階から選択してください"
    ),
  room_number: z.string().trim().min(1, "部屋番号を入力してください"),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * role によって room_number の形式が変わるため、role を渡して検証する。
 * resident: 2桁数字+ユニット文字(A-D)  例 "01A"
 * ra      : 2桁数字のみ                例 "01"
 */
export function validateRoomNumberForRole(
  roomNumber: string,
  role: "resident" | "ra"
) {
  const pattern = role === "ra" ? /^[0-9]{2}$/ : /^[0-9]{2}[A-D]$/;
  return pattern.test(roomNumber);
}
