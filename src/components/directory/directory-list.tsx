"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatRoomNumber } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import type { DirectoryProfileRow } from "@/types/database";

/**
 * 寮生ディレクトリの一覧表示。件数がそれほど多くない寮という前提のもと、
 * サーバーへの再問い合わせなしでクライアント側の絞り込みのみで検索を実現する。
 */
export function DirectoryList({
  profiles,
  currentUserId,
}: {
  profiles: DirectoryProfileRow[];
  currentUserId: string;
}) {
  const dict = useDict();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => {
      const haystack = [
        p.full_name ?? "",
        p.faculty ?? "",
        p.grade_level ?? "",
        formatRoomNumber(p.floor_number, p.room_number),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [profiles, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.directory.searchPlaceholder}
          className="pl-9"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/directory/${p.id}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
              {p.full_name?.charAt(0) ?? "?"}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {p.full_name ?? dict.common.notRegistered}
                {p.role === "ra" && <Badge variant="default">RA</Badge>}
                {p.id === currentUserId && (
                  <span className="text-xs font-normal text-muted-foreground">
                    ({dict.raRooms.you})
                  </span>
                )}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {formatRoomNumber(p.floor_number, p.room_number)}
              </span>
            </span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            {dict.directory.noResults}
          </p>
        )}
      </div>
    </div>
  );
}
