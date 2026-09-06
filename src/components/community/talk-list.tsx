"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Building2, MessageCircle, RefreshCw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/locales";

export type TalkItem = {
  href: string;
  title: string;
  image: string | null;
  floor?: boolean;
  preview: string;
  lastMessageAt: string | null;
  timeLabel?: string;
  unread: boolean;
};

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().trim();

export function TalkList({ threads, locale }: { threads: TalkItem[]; locale: Locale }) {
  const en = locale === "en";
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(40);
  const [pending, startTransition] = useTransition();
  const term = normalize(query);
  const filtered = threads.filter(thread => (!unreadOnly || thread.unread) && (!term || normalize(`${thread.title} ${thread.preview}`).includes(term)));
  const unreadCount = threads.filter(thread => thread.unread).length;

  return <>
    <div className="mb-2 flex min-w-0 items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" aria-label={en ? "Search conversations" : "トークを検索"} placeholder={en ? "Search" : "検索"} value={query} onChange={event => { setQuery(event.target.value); setLimit(40); }} className="h-11 w-full min-w-0 rounded-xl border-0 bg-secondary/60 pl-9 pr-11 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:appearance-none" />
        {query && <button type="button" aria-label={en ? "Clear search" : "検索をクリア"} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setQuery(""); setLimit(40); }}><X aria-hidden="true" className="h-4 w-4" /></button>}
      </div>
      <Button type="button" variant={unreadOnly ? "secondary" : "ghost"} aria-pressed={unreadOnly} className="h-11 shrink-0 gap-1.5 px-2.5 text-xs" onClick={() => { setUnreadOnly(!unreadOnly); setLimit(40); }}>{en ? "Unread" : "未読"}{unreadCount > 0 && <span className="tabular-nums text-primary">{unreadCount}</span>}</Button>
      <Button type="button" variant="ghost" disabled={pending} aria-label={en ? "Refresh conversations" : "トークを更新"} className="h-11 w-11 shrink-0 p-0" onClick={() => startTransition(() => router.refresh())}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${pending ? "motion-safe:animate-spin" : ""}`} /></Button>
    </div>
    <p role="status" className="sr-only">{pending ? (en ? "Updating conversations" : "トークを更新しています") : (en ? `${filtered.length} conversations` : `${filtered.length}件のトーク`)}</p>
    <ul aria-label={en ? "Conversations" : "トーク一覧"} aria-busy={pending}>
      {filtered.slice(0, limit).map(thread => <li key={thread.href}>
        <Link href={thread.href} prefetch={false} className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-3 transition-colors hover:bg-secondary/50 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3">
          {thread.image ? <Image src={thread.image} alt="" width={56} height={56} sizes="56px" className="h-14 w-14 shrink-0 rounded-full object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">{thread.floor ? <Building2 aria-hidden="true" className="h-6 w-6" /> : <MessageCircle aria-hidden="true" className="h-6 w-6" />}</span>}
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15px] ${thread.unread ? "font-bold" : "font-medium"}`}>{thread.title}</span>
            <span className="mt-1 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
              <span className={`min-w-0 flex-1 truncate ${thread.unread ? "font-medium text-foreground" : ""}`}>{thread.preview}</span>
              {thread.lastMessageAt && <time dateTime={thread.lastMessageAt} className="shrink-0 text-xs">{thread.timeLabel}</time>}
            </span>
          </span>
          {thread.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary"><span className="sr-only">{en ? "Unread" : "未読"}</span></span>}
        </Link>
      </li>)}
    </ul>
    {filtered.length === 0 && <div className="space-y-3 py-12 text-center text-sm text-muted-foreground"><p>{term ? (en ? "No matching conversations." : "一致するトークはありません。") : unreadOnly ? (en ? "You're all caught up." : "未読のトークはありません。") : (en ? "No conversations yet." : "まだトークはありません。")}</p>{(term || unreadOnly) && <Button type="button" variant="ghost" onClick={() => { setQuery(""); setUnreadOnly(false); setLimit(40); }}>{en ? "Show all conversations" : "すべてのトークを表示"}</Button>}</div>}
    {filtered.length > limit && <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => setLimit(value => value + 40)}>{en ? "Show more" : "もっと見る"}</Button>}
  </>;
}
