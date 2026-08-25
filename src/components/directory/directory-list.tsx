"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { formatRoomNumber } from "@/lib/utils";
import { useDict } from "@/lib/i18n/locale-provider";
import type { DirectoryProfileRow } from "@/types/database";

function Avatar({ name, url, role }: { name: string | null; url: string | null; role?: string }) {
  return (
    <AvatarRing role={role}>
      {url ? (
        <Image
          src={url}
          alt=""
          width={44}
          height={44}
          className="h-11 w-11 shrink-0 rounded-full object-cover shadow-sm"
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground shadow-sm">
          {name?.charAt(0) ?? "?"}
        </span>
      )}
    </AvatarRing>
  );
}

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
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.directory.searchPlaceholder}
          className="h-11 rounded-full pl-10 shadow-sm"
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/directory/${p.id}`}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover"
          >
            <Avatar name={p.full_name} url={p.avatar_url} role={p.role} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-center gap-1.5 truncate font-medium transition-colors group-hover:text-primary">
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
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            {dict.directory.noResults}
          </p>
        )}
      </div>
    </div>
  );
}
