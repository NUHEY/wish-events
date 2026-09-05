import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ToolCard({ href, title, description, icon: Icon, accent, badges }: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  badges?: ReactNode;
}) {
  return <Link href={href} className={cn("group min-w-0 rounded-2xl border border-border bg-gradient-to-br p-4 shadow-card transition-transform active:scale-[0.98]", accent)}>
    <div className="flex items-start justify-between gap-2">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-card/80 shadow-sm"><Icon aria-hidden="true" className="h-5 w-5" /></span>
      <div className="flex items-center gap-2">{badges}<ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0" /></div>
    </div>
    <h3 className="mt-4 break-words font-extrabold text-foreground">{title}</h3>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
  </Link>;
}
