import { z } from "zod";
import { EVENT_CATEGORIES, FLOORS, SURVEY_TYPES } from "@/lib/constants";

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, "タイトルを入力してください").max(200),
    title_en: z.string().trim().optional().default(""),
    category: z.enum(EVENT_CATEGORIES),
    description: z.string().trim().optional().default(""),
    description_en: z.string().trim().optional().default(""),
    poster_url: z.string().url().optional().or(z.literal("")).default(""),
    location: z.string().trim().optional().default(""),
    location_en: z.string().trim().optional().default(""),
    target_audience: z.string().trim().optional().default(""),
    target_audience_en: z.string().trim().optional().default(""),
    event_date: z.string().min(1, "開催日時を入力してください"),
    requires_registration: z.boolean().default(false),
    capacity: z.coerce.number().int().positive().optional().nullable(),
    fee_amount: z.coerce.number().int().min(0).optional().nullable(),
    payment_info: z.string().trim().optional().default(""),
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
  })
  .refine(
    (data) => !data.requires_registration || !!data.capacity,
    {
      message: "事前申し込みを有効にする場合は定員を入力してください",
      path: ["capacity"],
    }
  )
  .refine(
    (data) => data.survey_type !== "external" || !!data.survey_external_url,
    {
      message: "外部アンケートを選択した場合はURLを入力してください",
      path: ["survey_external_url"],
    }
  );

export type EventInput = z.infer<typeof eventSchema>;
