import { z } from "zod";

export const announcementSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(200),
  category_label: z.string().trim().max(50).optional().default(""),
  body: z.string().trim().min(1, "本文を入力してください"),
  cover_image_url: z.string().url().optional().or(z.literal("")).default(""),
  pinned: z.boolean().default(false),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;
