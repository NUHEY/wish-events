"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Home, LayoutDashboard, MessageCircle, Settings2, Sparkles, type LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import type { UserRole } from "@/types/database";

const ONBOARDING_STORAGE_KEY = "wish-events-onboarding-v1";
type StepId = "welcome" | "events" | "talks" | "tools" | "settings" | "management" | "ready";
type Step = { title: string; description: string; points: readonly string[] };
const icons: Record<StepId, LucideIcon> = { welcome: Home, events: CalendarDays, talks: MessageCircle, tools: Sparkles, settings: Settings2, management: LayoutDashboard, ready: Check };

const copy = {
  ja: {
    guide: "使い方ガイド", skip: "スキップ", previous: "戻る", next: "次へ", step: "{current} / {total}", openHome: "ホームへ", openDashboard: "管理ボードへ",
    steps: {
      welcome: { title: "4つのタブから始めよう", description: "画面下のタブから、目的のページへ移動できます。", points: ["ホーム：新着情報とお知らせ", "イベント・トーク・便利ツールを使い分ける"] },
      events: { title: "イベントを探して参加", description: "気になるカードを開くと、日時や申込方法が分かります。", points: ["検索・フィルター・日付で探す", "申し込んだイベントの連絡はトークへ"] },
      talks: { title: "連絡はトークで確認", description: "イベントやフロアの連絡、友達との会話をまとめて確認します。", points: ["未読の印があるトークを確認", "個別の画面から戻ると、トーク一覧へ"] },
      tools: { title: "相談も、日程調整も", description: "便利ツールから、知恵袋や日程調整、よく使うリンクを開けます。", points: ["知恵袋で質問。RAだけへの相談も可能", "投稿前に、閲覧・回答できる人を選ぶ"] },
      settings: { title: "自分に合う表示に", description: "右上のアイコンから「自分の設定」を開きます。", points: ["日本語・Englishとテーマを変更", "プロフィール編集・使い方ガイドも右上へ"] },
      management: { title: "運営の操作は管理ボード", description: "右上のメニューから、権限に応じた管理項目を開けます。", points: ["メニューから管理したい項目を選ぶ", "関係者の操作範囲はRAが設定"] },
      ready: { title: "準備ができました", description: "ホームで新着情報を確認してみましょう。", points: ["気になるイベントやお知らせを開く", "困ったときは右上からこのガイドへ"] },
    },
  },
  en: {
    guide: "Quick guide", skip: "Skip", previous: "Back", next: "Next", step: "{current} / {total}", openHome: "Open home", openDashboard: "Open dashboard",
    steps: {
      welcome: { title: "Start with four tabs", description: "Use the bottom tabs to get around.", points: ["Home: updates and announcements", "Events · Talks · Tools"] },
      events: { title: "Find an event and join", description: "Open an event card for dates and registration details.", points: ["Search, filter by category or choose a date", "Find event messages in Talks after joining"] },
      talks: { title: "Keep up in Talks", description: "Find event and floor messages, and conversations with friends.", points: ["Look for the unread indicator", "Use Back in a conversation to return to the list"] },
      tools: { title: "Ask, plan and find help", description: "Tools brings together WISH Knowledge, scheduling and useful links.", points: ["Ask the community or send a private RA question", "Choose who can read and answer before posting"] },
      settings: { title: "Make it yours", description: "Tap your top-right avatar, then Your settings.", points: ["Change your language and theme", "Find profile editing and this guide in the same menu"] },
      management: { title: "Manage from the dashboard", description: "Your top-right menu opens the areas you have permission to manage.", points: ["Choose an area from the management menu", "RAs set what staff accounts can access"] },
      ready: { title: "You are ready", description: "Check Home for the latest updates.", points: ["Open an event or announcement", "Find this guide in your avatar menu"] },
    },
  },
} satisfies Record<Locale, { guide: string; skip: string; previous: string; next: string; step: string; openHome: string; openDashboard: string; steps: Record<StepId, Step> }>;

export function OnboardingFlow({ locale, role, canAccessManagement = role === "ra" }: { locale: Locale; role: UserRole; name: string; canAccessManagement?: boolean }) {
  const text = copy[locale];
  const ids: StepId[] = ["welcome", "events", "talks", "tools", "settings", ...(canAccessManagement ? ["management" as const] : []), "ready"];
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, ids.length - 1);
  const id = ids[safeIndex];
  const step = text.steps[id];
  const Icon = icons[id];
  const isLast = safeIndex === ids.length - 1;
  const progress = text.step.replace("{current}", String(safeIndex + 1)).replace("{total}", String(ids.length));

  function rememberCompletion() {
    try { window.localStorage.setItem(ONBOARDING_STORAGE_KEY, new Date().toISOString()); }
    catch { /* The guide remains usable when browser storage is disabled. */ }
  }

  return <div className="mx-auto w-full max-w-xl">
    <section aria-label={text.guide} className="rounded-2xl border border-border bg-card shadow-card">
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-border px-3 sm:px-5">
        <span className="text-sm font-semibold">{text.guide}</span>
        <div className="flex items-center gap-1"><span className="text-xs tabular-nums text-muted-foreground">{progress}</span>
        {!isLast && <Link href="/" onClick={rememberCompletion} className="inline-flex min-h-11 items-center rounded-md px-2 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{text.skip}</Link>}</div>
      </header>
      <div role="progressbar" aria-label={text.guide} aria-valuemin={1} aria-valuemax={ids.length} aria-valuenow={safeIndex + 1} aria-valuetext={progress} className="h-1 bg-secondary">
        <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${((safeIndex + 1) / ids.length) * 100}%` }} />
      </div>
      <div className="p-3 sm:p-6">
        <div key={id} aria-live="polite" aria-atomic="true">
          <div className="flex items-start gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon aria-hidden="true" className="h-4 w-4" /></span><h1 className="min-w-0 break-words text-lg font-bold leading-snug sm:text-2xl">{step.title}</h1></div>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{step.description}</p>
          <ul className="mt-3 space-y-2">{step.points.map((point) => <li key={point} className="flex items-start gap-2 text-sm leading-5"><Check aria-hidden="true" className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 break-words">{point}</span></li>)}</ul>
        </div>
        <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2">
          {safeIndex > 0 && <Button type="button" variant="outline" onClick={() => setIndex((current) => Math.max(0, current - 1))} className="px-3"><ArrowLeft aria-hidden="true" className="h-4 w-4" />{text.previous}</Button>}
          {!isLast ? <Button type="button" onClick={() => setIndex((current) => Math.min(ids.length - 1, current + 1))} className="ml-auto flex-1 sm:max-w-44">{text.next}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Button> : <Link href="/" onClick={rememberCompletion} className={buttonVariants({ className: "ml-auto flex-1 sm:max-w-44" })}><Home aria-hidden="true" className="h-4 w-4" />{text.openHome}</Link>}
          {isLast && canAccessManagement && <Link href="/dashboard" onClick={rememberCompletion} className="inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{text.openDashboard}<ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Link>}
        </footer>
      </div>
    </section>
  </div>;
}
