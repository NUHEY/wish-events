import { z } from "zod";
import { EVENT_CATEGORIES, FLOORS, SURVEY_TYPES } from "@/lib/constants";

const eventMediaUrl = z.string().refine(
  (value) => value === "" || value.startsWith("/images/event-presets/") || z.string().url().safeParse(value).success,
  "画像URLの形式が正しくありません"
).default("");

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "タイトルを入力してください").max(200),
    title_en: z.string().trim().optional().default(""),
    category: z.enum(EVENT_CATEGORIES),
    description: z.string().trim().optional().default(""),
    description_en: z.string().trim().optional().default(""),
    poster_url: eventMediaUrl,
    thumbnail_url: eventMediaUrl,
    location: z.string().trim().optional().default(""),
    location_en: z.string().trim().optional().default(""),
    target_audience: z.string().trim().optional().default(""),
    target_audience_en: z.string().trim().optional().default(""),
    event_date: z.string().min(1, "開催日時を入力してください"),
    requires_registration: z.boolean().default(true),
    capacity: z.coerce.number().int().positive().optional().nullable(),
    fee_amount: z.coerce.number().int().min(0).optional().nullable(),
    // 無料イベント（fee_amountが空）のとき、一覧カードに「無料」タグを表示するかどうか。
    // 詳細未定・寄付制などの理由でRAが意図的に非表示にしたい場合のためのトグル。
    show_free_tag: z.boolean().default(true),
    payment_info: z.string().trim().optional().default(""),
    payment_due_at: z.string().trim().optional().default(""),
    payment_destination: z.string().trim().max(2000).optional().default(""),
    // 空文字は「即公開/即申込可」を意味するnullとして扱う。
    publish_at: z.string().trim().optional().default(""),
    registration_opens_at: z.string().trim().optional().default(""),
    // 空文字は「締切なし」を意味するnullとして扱う。
    registration_closes_at: z.string().trim().optional().default(""),
    target_floors: z
      .array(z.coerce.number().refine((v) => (FLOORS as readonly number[]).includes(v)))
      .optional()
      .default([]),
    survey_type: z.enum(SURVEY_TYPES).default("none"),
    survey_external_url: z
      .string()
      .url("有効なURLを入力してください")
      .optional()
      .or(z.literal(""))
      .default(""),
    // 詳細設定（すべて任意）
    location_url: z
      .string()
      .url("有効なURLを入力してください")
      .optional()
      .or(z.literal(""))
      .default(""),
    contact_info: z.string().trim().max(500).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
    is_pinned: z.boolean().default(false),
    member_ids: z.array(z.string().uuid()).optional().default([]),
    all_ra_members: z.boolean().default(false),
  })
  .refine(
    (data) => data.survey_type !== "external" || !!data.survey_external_url,
    {
      message: "外部アンケートを選択した場合はURLを入力してください",
      path: ["survey_external_url"],
    }
  )
  .refine(
    (data) =>
      !data.registration_opens_at ||
      !data.registration_closes_at ||
      new Date(data.registration_closes_at).getTime() > new Date(data.registration_opens_at).getTime(),
    {
      message: "申込締切は申込開始より後の日時にしてください",
      path: ["registration_closes_at"],
    }
  );

export type EventInput = z.infer<typeof eventSchema>;
