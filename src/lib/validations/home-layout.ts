import { z } from "zod";
import { HOME_SECTION_KEYS, HOME_ACCENT_KEYS } from "@/lib/constants";

const homeLayoutSectionSchema = z.object({
  section_key: z.enum(HOME_SECTION_KEYS),
  visible: z.boolean().default(true),
  position: z.coerce.number().int().min(1),
  accent: z.enum(HOME_ACCENT_KEYS).optional().or(z.literal("")).default(""),
  title_ja: z.string().trim().max(60).optional().default(""),
  title_en: z.string().trim().max(60).optional().default(""),
});

export const homeLayoutSchema = z.object({
  sections: z.array(homeLayoutSectionSchema).length(HOME_SECTION_KEYS.length),
});

export type HomeLayoutInput = z.infer<typeof homeLayoutSchema>;
