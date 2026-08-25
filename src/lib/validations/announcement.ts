import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(200),
  category_label: z.string().trim().min(1, "カテゴリを入力してください").max(50),
  body: z.string().trim().min(1, "本文を入力してください"),
  cover_image_url: z.string().url().optional().or(z.literal("")).default(""),
  pinned: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(20)).max(10).optional().default([]),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;
