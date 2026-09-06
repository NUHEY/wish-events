import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ToolCard } from "@/components/tools/tool-card";
import { BetaBadge } from "@/components/tools/beta-badge";
import type { FeatureFlagState } from "@/lib/feature-flags";
import type { Locale } from "@/lib/i18n/locales";
import { RESIDENT_TOOLS, type ToolKey } from "@/lib/resident-tools";
export { RESIDENT_TOOLS } from "@/lib/resident-tools";
import { cn } from "@/lib/utils";


export function ResidentToolGrid({
  stateByKey,
  profileRole,
  includedKeys,
  compact = false,
  density = "minimal",
  locale = "ja",
}: {
  stateByKey: Partial<Record<ToolKey, FeatureFlagState>>;
  profileRole: "resident" | "ra";
  includedKeys?: ToolKey[];
  compact?: boolean;
  density?: "minimal" | "compact";
  locale?: Locale;
}) {
  const tools = includedKeys
    ? includedKeys.flatMap(key => RESIDENT_TOOLS.filter(tool => tool.key === key))
    : RESIDENT_TOOLS;
  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-3">
        {tools.map((tool) => {
          const state = tool.featureKey ? stateByKey[tool.key] ?? "hidden" : "public";
          const href = profileRole === "ra" ? tool.createHref : tool.residentHref;
          const title = locale === "en" ? tool.titleEn : tool.title;
          const description = locale === "en"
            ? profileRole === "resident" && tool.residentDescriptionEn ? tool.residentDescriptionEn : tool.descriptionEn
            : profileRole === "resident" && tool.residentDescription ? tool.residentDescription : tool.description;
          return (
            <Link
              key={tool.key}
              href={href}
              className={cn(
                "flex min-h-24 min-w-0 flex-col items-start justify-center gap-2 sm:flex-row sm:items-center rounded-xl border border-border bg-gradient-to-br p-3 shadow-sm transition-transform active:scale-[0.98] sm:gap-3 sm:p-3.5",
                tool.accent
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/85 shadow-sm sm:h-10 sm:w-10">
                <tool.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 w-full sm:w-auto sm:flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="break-words text-xs font-bold sm:text-sm text-foreground">{title}</span>
                  {state === "beta" && <BetaBadge />}
                </span>
                {density === "compact" && <span className="mt-1 hidden text-[11px] leading-relaxed text-muted-foreground sm:line-clamp-2">{description}</span>}
              </span>
              <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
            </Link>
          );
        })}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => {
        const state = tool.featureKey ? stateByKey[tool.key] ?? "hidden" : "public";
        const href = profileRole === "ra" ? tool.createHref : tool.residentHref;
        const title = locale === "en" ? tool.titleEn : tool.title;
        const description = locale === "en"
          ? profileRole === "resident" && tool.residentDescriptionEn ? tool.residentDescriptionEn : tool.descriptionEn
          : profileRole === "resident" && tool.residentDescription ? tool.residentDescription : tool.description;
        return (
          <ToolCard key={tool.key} href={href} title={title} description={description} icon={tool.icon} accent={tool.accent}
            badges={<>{state === "beta" && <BetaBadge />}{state === "hidden" && profileRole === "ra" && <span className="rounded-full bg-secondary px-2 py-1 text-[9px] font-bold text-muted-foreground">{locale === "en" ? "Private preview" : "非公開プレビュー"}</span>}</>} />
        );
      })}
    </div>
  );
}
