"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, SlidersHorizontal, ArrowUpRight, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { cn, formatRoomNumber } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import { LANGUAGES, COUNTRIES, findLabel } from "@/lib/i18n/profile-options";
import { DIRECTORY_FIELDS, matchesDirectoryFilters, type DirectoryField, type DirectoryFilters } from "./directory-filters";
import type { DirectoryProfileRow } from "@/types/database";

/** Only the privacy-filtered directory RPC data is searched and displayed. */
export function DirectoryList({ profiles, currentUserId, initialFilters = {} }: {
  profiles: DirectoryProfileRow[];
  currentUserId: string;
  initialFilters?: DirectoryFilters;
}) {
  const dict = useDict();
  const locale = useLocale();
  const en = locale === "en";
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const viewer = profiles.find((p) => p.id === currentUserId);
  const initialKey = JSON.stringify(initialFilters);
  React.useEffect(() => { setFilters(JSON.parse(initialKey)); }, [initialKey]);

  const labels: Record<DirectoryField, string> = {
    faculty: en ? "Faculty" : "学部",
    grade_level: en ? "Year" : "学年",
    languages: en ? "Languages" : "話せる言語",
    nationalities: en ? "Nationality" : "国籍",
    lived_countries: en ? "Places lived" : "暮らした国・地域",
  };
  function label(field: DirectoryField, value: string) {
    if (field === "faculty") return dict.faculties[value as keyof typeof dict.faculties] ?? value;
    if (field === "grade_level") return dict.gradeLevels[value as keyof typeof dict.gradeLevels] ?? value;
    return findLabel(field === "languages" ? LANGUAGES : COUNTRIES, value, locale);
  }
  const options = React.useMemo(() => Object.fromEntries(DIRECTORY_FIELDS.map((field) => [field,
    [...new Set(profiles.flatMap((p) => {
      const value = p[field];
      return Array.isArray(value) ? value : value ? [value] : [];
    }))].sort(),
  ])) as Record<DirectoryField, string[]>, [profiles]);

  const q = query.trim().toLocaleLowerCase(locale);
  const filtered = profiles.filter((p) => {
    if (!matchesDirectoryFilters(p, filters)) return false;
    if (!q) return true;
    return [p.full_name, p.self_intro, formatRoomNumber(p.floor_number, p.room_number),
      ...DIRECTORY_FIELDS.flatMap((field) => {
        const value = p[field];
        return (Array.isArray(value) ? value : value ? [value] : []).flatMap((item) => [item, label(field, item)]);
      }),
    ].join(" ").toLocaleLowerCase(locale).includes(q);
  });
  const active = DIRECTORY_FIELDS.filter((field) => filters[field]);
  function clear() { setQuery(""); setFilters({}); }

  return <div className="flex min-w-0 flex-col gap-4">
    <section className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-4" aria-label={en ? "Find residents" : "寮生を探す"}>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={en ? "Search residents" : "寮生を検索"} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={en ? "Name, interests, language, room…" : "名前・趣味・言語・部屋番号など"} className="h-11 pl-10" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={filtersOpen ? "secondary" : "outline"} className="gap-1.5" aria-expanded={filtersOpen} aria-controls="directory-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal aria-hidden className="h-4 w-4" />{en ? "Filter" : "条件で探す"}{active.length > 0 && <span className="tabular-nums">({active.length})</span>}</Button>
      </div>
      {filtersOpen && <div id="directory-filters" className="grid min-w-0 gap-3 border-t border-border pt-3 sm:grid-cols-2">
        {DIRECTORY_FIELDS.map((field) => <label key={field} className="grid min-w-0 gap-1.5 text-xs font-medium">{labels[field]}
          <select value={filters[field] ?? ""} onChange={(e) => setFilters((prev) => ({ ...prev, [field]: e.target.value }))} className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="">{en ? "Any" : "指定なし"}</option>
            {[...new Set([...options[field], ...(filters[field] ? [filters[field]!] : [])])].map((value) => <option key={value} value={value}>{label(field, value)}</option>)}
          </select>
        </label>)}
      </div>}
      {active.length > 0 && <div className="flex flex-wrap gap-2">
        {active.map((field) => <button key={field} type="button" onClick={() => setFilters((prev) => ({ ...prev, [field]: "" }))} aria-label={`${labels[field]}: ${label(field, filters[field]!)} ${en ? "— remove filter" : "の条件を解除"}`} className="inline-flex min-h-10 max-w-full items-center gap-1 rounded-lg bg-secondary px-2.5 text-xs"><span className="min-w-0 break-words">{labels[field]}: {label(field, filters[field]!)}</span><X aria-hidden className="h-3.5 w-3.5 shrink-0" /></button>)}
      </div>}
    </section>

    {(q || active.length > 0) && <div className="flex justify-end">
      <Button type="button" variant="ghost" onClick={clear}>{en ? "Clear" : "条件をクリア"}</Button>
    </div>}
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      {filtered.map((p) => {
        const common = p.id !== currentUserId ? (p.languages ?? []).filter((code) => viewer?.languages?.includes(code)) : [];
        return <Link key={p.id} href={`/directory/${p.id}`} className="group flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex min-w-0 items-center gap-3">
            <AvatarRing role={p.role} size={44}><Image src={p.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" /></AvatarRing>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5"><span className="truncate font-semibold">{p.full_name ?? dict.common.notRegistered}</span>{p.role === "ra" && <Badge className="shrink-0">RA</Badge>}{p.id === currentUserId && <span className="shrink-0 text-xs text-muted-foreground">({dict.raRooms.you})</span>}</div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{[formatRoomNumber(p.floor_number, p.room_number), p.faculty && label("faculty", p.faculty)].filter(Boolean).join(" · ")}</p>
            </div><ArrowUpRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
          <p className={cn("line-clamp-2 break-words text-sm leading-relaxed [overflow-wrap:anywhere]", !p.self_intro && "text-muted-foreground")}>{p.self_intro || dict.directory.noSelfIntro}</p>
          {!!p.languages?.length && <div className="flex flex-wrap gap-1.5">{p.languages.slice(0, 3).map((code) => <span key={code} className={cn("rounded-md px-2 py-1 text-xs", common.includes(code) ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>{label("languages", code)}</span>)}{p.languages.length > 3 && <span className="py-1 text-xs text-muted-foreground">+{p.languages.length - 3}</span>}</div>}
        </Link>;
      })}
      {!filtered.length && <div className="col-span-full rounded-xl border border-dashed border-border px-4 py-8 text-center"><p className="text-sm">{dict.directory.noResults}</p><p className="mt-2 text-xs text-muted-foreground">{en ? "Try fewer filters or a different keyword." : "条件を減らすか、別のキーワードで探してみましょう。"}</p><Button type="button" variant="outline" className="mt-4" onClick={clear}>{en ? "Show everyone" : "すべての寮生を見る"}</Button></div>}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{en ? "Open a profile to send a friend request. Share your interests in your introduction to help others say hello." : "プロフィールから友達申請ができます。自己紹介に好きなことを書くと、会話のきっかけになります。"} <Link className="underline underline-offset-4" href="/profile/edit">{en ? "Edit introduction" : "自己紹介を編集"}</Link></p>
  </div>;
}
