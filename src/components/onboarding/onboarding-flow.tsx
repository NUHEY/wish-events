"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Heart,
  Home,
  LayoutDashboard,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";
import type { UserRole } from "@/types/database";

const ONBOARDING_STORAGE_KEY = "wish-events-onboarding-v1";

type StepId = "welcome" | "events" | "community" | "profile" | "ra" | "ready";

type Step = {
  id: StepId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  points: readonly string[];
  icon: LucideIcon;
};

const copy = {
  ja: {
    guide: "使い方ガイド",
    skip: "スキップ",
    previous: "戻る",
    next: "次へ",
    step: "ステップ {current} / {total}",
    openHome: "ホームを見てみる",
    openDashboard: "管理画面を開く",
    review: "このガイドは右上のプロフィールメニューから、いつでも見直せます。",
    steps: {
      welcome: {
        label: "はじめに",
        eyebrow: "Welcome to WISH",
        title: "寮生活の情報を、ひとつの場所に。",
        description: "WISH Eventsでは、イベントを探すところから参加後の連絡、寮内のお知らせまでをスムーズに確認できます。",
        points: ["イベントとお知らせをすぐ確認", "スマホでも迷わないシンプルな導線", "日本語・Englishをいつでも切り替え"],
      },
      events: {
        label: "イベント",
        eyebrow: "Discover",
        title: "気になるイベントを見つけて参加",
        description: "ホームのおすすめやイベント一覧から探し、詳細画面の「申し込む」で自分の予定に追加できます。",
        points: ["日付・対象・キーワードで検索", "申込後はイベント専用トークに参加", "カレンダー追加や事前質問にも対応"],
      },
      community: {
        label: "つながる",
        eyebrow: "Stay connected",
        title: "大事な連絡も、みんなの反応も見逃さない",
        description: "お知らせ、コメント、いいね、トークがひとつにつながっています。未読があると赤い印でお知らせします。",
        points: ["お知らせへのコメント・返信・いいね", "イベントトークで画像・投票・アンケート", "新着通知と未読トークをひと目で確認"],
      },
      profile: {
        label: "プロフィール",
        eyebrow: "Meet your neighbors",
        title: "プロフィールから交流のきっかけを",
        description: "話せる言語や出身地、自己紹介を登録すると、寮生ディレクトリでお互いを知りやすくなります。",
        points: ["言語・国や地域から寮生を検索", "SNSやLINEは自分で登録した内容だけ表示", "右上のアイコンからいつでも編集"],
      },
      ra: {
        label: "RA機能",
        eyebrow: "For Resident Assistants",
        title: "運営に必要な機能は管理画面に集約",
        description: "RAはイベント・お知らせ・通知の作成から、参加者や居住情報、公開機能まで管理できます。",
        points: ["スマホではドロワー、PCでは左メニュー", "対象者を絞った通知とイベント管理", "ベータ機能の公開状態も切り替え可能"],
      },
      ready: {
        label: "準備完了",
        eyebrow: "You're all set",
        title: "WISHでの毎日を、もっと楽しく。",
        description: "準備は完了です。まずはホームで、今週のイベントや最新のお知らせを見てみましょう。",
        points: ["ホームで最新情報をチェック", "気になるイベントに申し込む", "分からないときはこのガイドへ"],
      },
    },
  },
  en: {
    guide: "Quick guide",
    skip: "Skip",
    previous: "Back",
    next: "Next",
    step: "Step {current} of {total}",
    openHome: "Explore home",
    openDashboard: "Open dashboard",
    review: "You can revisit this guide anytime from your profile menu in the top-right corner.",
    steps: {
      welcome: {
        label: "Welcome",
        eyebrow: "Welcome to WISH",
        title: "Everything for dorm life, in one place.",
        description: "WISH Events keeps events, follow-up messages, and important dorm announcements easy to find.",
        points: ["See events and announcements at a glance", "Simple, mobile-friendly navigation", "Switch between 日本語 and English anytime"],
      },
      events: {
        label: "Events",
        eyebrow: "Discover",
        title: "Find an event and join in",
        description: "Browse recommendations or the event list, then tap Register on the detail page to add it to your plans.",
        points: ["Search by date, audience, or keyword", "Join the event talk after registering", "Add to your calendar and answer questions"],
      },
      community: {
        label: "Connect",
        eyebrow: "Stay connected",
        title: "Keep up with messages and reactions",
        description: "Announcements, comments, likes, and talks work together. A red badge lets you know when something is unread.",
        points: ["Comment, reply, and like announcements", "Share images, polls, and surveys in event talks", "Spot new notifications and unread talks"],
      },
      profile: {
        label: "Profile",
        eyebrow: "Meet your neighbors",
        title: "Turn your profile into a conversation starter",
        description: "Add your languages, places, and introduction so residents can get to know one another in the directory.",
        points: ["Find residents by language or region", "Only the social details you add are shown", "Edit anytime from your top-right avatar"],
      },
      ra: {
        label: "RA tools",
        eyebrow: "For Resident Assistants",
        title: "All operations live in the dashboard",
        description: "RAs can create events, announcements, and notifications while managing attendees, residents, and feature access.",
        points: ["Drawer on mobile, left navigation on desktop", "Targeted notifications and event management", "Control beta feature availability"],
      },
      ready: {
        label: "All set",
        eyebrow: "You're all set",
        title: "Make every day at WISH more connected.",
        description: "You're ready. Start on Home to see this week's events and the latest dorm announcements.",
        points: ["Check the latest updates on Home", "Register for something interesting", "Return to this guide whenever you need it"],
      },
    },
  },
} as const;

function Preview({ id, role }: { id: StepId; role: UserRole }) {
  if (id === "welcome" || id === "ready") {
    return (
      <div className="relative mx-auto flex h-44 w-full max-w-sm items-center justify-center overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.09] via-card to-info/[0.08] sm:h-52">
        <div className="absolute left-5 top-5 h-16 w-16 rounded-full bg-primary/10 blur-2xl motion-safe:animate-pulse" />
        <div className="absolute bottom-2 right-7 h-20 w-20 rounded-full bg-info/10 blur-2xl motion-safe:animate-pulse" />
        <div className="relative grid grid-cols-3 items-end gap-3" aria-hidden>
          <span className="flex h-20 w-16 rotate-[-7deg] flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-card motion-safe:animate-fade-in">
            <span className="h-8 rounded-md bg-secondary" /><span className="h-2 w-10 rounded-full bg-primary/20" /><span className="h-2 w-7 rounded-full bg-muted" />
          </span>
          <span className="flex h-28 w-20 flex-col gap-2 rounded-xl border border-primary/20 bg-card p-2.5 shadow-elevated motion-safe:animate-pop-in">
            <span className="flex h-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span><span className="h-2 w-12 rounded-full bg-primary/25" /><span className="h-2 w-9 rounded-full bg-muted" /><span className="mt-auto h-5 rounded-md bg-primary" />
          </span>
          <span className="flex h-20 w-16 rotate-[7deg] flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-card motion-safe:animate-fade-in">
            <span className="h-8 rounded-md bg-secondary" /><span className="h-2 w-9 rounded-full bg-info/25" /><span className="h-2 w-6 rounded-full bg-muted" />
          </span>
        </div>
      </div>
    );
  }

  if (id === "events") {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex h-10 items-center gap-2 rounded-full bg-secondary px-3 text-muted-foreground"><Search className="h-4 w-4" /><span className="h-2.5 w-28 rounded-full bg-muted-foreground/15" /></div>
        <div className="grid grid-cols-2 gap-3">
          {["from-primary/15 to-primary/[0.03]", "from-info/15 to-info/[0.03]"].map((tone, index) => (
            <div key={tone} className="overflow-hidden rounded-xl border border-border bg-background shadow-sm motion-safe:animate-fade-in" style={{ animationDelay: `${index * 70}ms` }}>
              <div className={cn("aspect-[1.6/1] bg-gradient-to-br", tone)} />
              <div className="space-y-2 p-2.5"><span className="block h-2.5 w-4/5 rounded-full bg-foreground/15" /><span className="block h-2 w-1/2 rounded-full bg-muted-foreground/15" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "community") {
    return (
      <div className="mx-auto w-full max-w-sm space-y-2 rounded-2xl border border-border bg-gradient-to-b from-secondary/35 to-card p-4 shadow-card">
        <div className="flex items-center justify-between border-b border-border/70 pb-3"><div className="flex items-center gap-2"><span className="h-8 w-8 rounded-full bg-primary/15" /><span className="h-3 w-24 rounded-full bg-foreground/15" /></div><span className="relative"><Bell className="h-5 w-5 text-muted-foreground" /><span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" /></span></div>
        <div className="flex justify-start"><span className="max-w-[78%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-xs text-secondary-foreground">Welcome to the event talk!</span></div>
        <div className="flex justify-end"><span className="flex max-w-[78%] items-center gap-2 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-xs text-primary-foreground"><Heart className="h-3.5 w-3.5" /> Sounds great!</span></div>
        <div className="flex items-center gap-2 pt-2"><span className="h-9 flex-1 rounded-full border border-input bg-background" /><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="h-4 w-4" /></span></div>
      </div>
    );
  }

  if (id === "profile") {
    return (
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="h-16 bg-gradient-to-r from-primary/10 via-info/10 to-secondary" />
        <div className="px-4 pb-4"><div className="-mt-7 h-14 w-14 rounded-full border-4 border-card bg-secondary" /><div className="mt-2 h-4 w-28 rounded-full bg-foreground/15" /><div className="mt-1.5 h-2.5 w-16 rounded-full bg-muted-foreground/15" /><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary">日本語</span><span className="rounded-full bg-info/10 px-3 py-1 text-[10px] font-semibold text-info">English</span><span className="rounded-full bg-secondary px-3 py-1 text-[10px] font-semibold">Student</span></div></div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-sm grid-cols-[88px_1fr] gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="space-y-2 rounded-xl bg-secondary/60 p-2">{[0, 1, 2, 3].map((item) => <span key={item} className={cn("block h-8 rounded-lg", item === 0 ? "bg-primary" : "bg-card")} />)}</div>
      <div className="space-y-3 p-1"><div className="flex items-center justify-between"><span className="h-4 w-24 rounded-full bg-foreground/15" /><ShieldCheck className="h-5 w-5 text-primary" /></div><div className="grid grid-cols-2 gap-2">{[CalendarDays, Bell, UsersRound, LayoutDashboard].map((Icon, index) => <span key={index} className="flex aspect-square items-center justify-center rounded-xl border border-border bg-background text-primary"><Icon className="h-5 w-5" /></span>)}</div>{role === "ra" && <span className="block h-7 rounded-lg bg-primary/10" />}</div>
    </div>
  );
}

export function OnboardingFlow({ locale, role, name }: { locale: Locale; role: UserRole; name: string }) {
  const text = copy[locale];
  const steps = useMemo<Step[]>(() => {
    const ids: StepId[] = role === "ra"
      ? ["welcome", "events", "community", "profile", "ra", "ready"]
      : ["welcome", "events", "community", "profile", "ready"];

    return ids.map((id) => ({ ...text.steps[id], id, icon: {
      welcome: Sparkles,
      events: CalendarDays,
      community: MessageCircle,
      profile: UserRound,
      ra: ShieldCheck,
      ready: Check,
    }[id] }));
  }, [role, text]);
  const [index, setIndex] = useState(0);
  const [contentRef] = useAutoAnimate<HTMLDivElement>({ duration: 190, easing: "ease-out" });
  const step = steps[index];
  const Icon = step.icon;
  const isLast = index === steps.length - 1;

  function rememberCompletion() {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, new Date().toISOString());
    } catch {
      // ストレージを制限したブラウザでも、ガイドからの移動自体は妨げない。
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] max-w-4xl flex-col justify-center py-1 sm:py-5">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-primary/[0.06] to-transparent" aria-hidden />
        <div className="relative flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 text-sm font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></span>{text.guide}</div>
          {!isLast && <Link href="/" onClick={rememberCompletion} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors active:bg-secondary sm:hover:text-foreground">{text.skip}</Link>}
        </div>

        <div className="relative h-1 bg-secondary" aria-hidden><div className="h-full rounded-r-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>

        <div className="grid min-h-[35rem] md:grid-cols-[0.92fr_1.08fr] md:items-stretch">
          <div className="flex items-center bg-secondary/20 p-4 sm:p-7 md:border-r md:border-border/70">
            <Preview id={step.id} role={role} />
          </div>

          <div ref={contentRef} className="flex min-w-0 flex-col p-5 sm:p-8">
            <div key={step.id} className="flex flex-1 flex-col motion-safe:animate-fade-in">
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary motion-safe:animate-pop-in"><Icon className="h-5 w-5" /></span>
                <span className="text-xs font-medium text-muted-foreground">{text.step.replace("{current}", String(index + 1)).replace("{total}", String(steps.length))}</span>
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{step.eyebrow}</p>
              <h1 className="mt-2 text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{index === 0 && name ? (locale === "ja" ? `${name}さん、` : `${name}, `) : ""}{step.title}</h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{step.description}</p>

              <ul className="mt-6 space-y-3">
                {step.points.map((point, pointIndex) => (
                  <li key={point} className="flex items-start gap-3 text-sm leading-6 motion-safe:animate-fade-in" style={{ animationDelay: `${pointIndex * 55}ms` }}><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-3 w-3" /></span><span>{point}</span></li>
                ))}
              </ul>

              {isLast && <p className="mt-5 rounded-xl bg-secondary/50 px-4 py-3 text-xs leading-5 text-muted-foreground">{text.review}</p>}

              <div className="mt-auto flex items-center gap-2 pt-7">
                {index > 0 && <Button type="button" variant="outline" onClick={() => setIndex((current) => current - 1)} className="h-11 px-3 active:scale-[0.98]"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">{text.previous}</span></Button>}
                {!isLast ? (
                  <Button type="button" onClick={() => setIndex((current) => current + 1)} className="ml-auto h-11 flex-1 active:scale-[0.98] sm:max-w-44">{text.next}<ArrowRight className="h-4 w-4" /></Button>
                ) : (
                  <div className="ml-auto flex flex-1 flex-col-reverse gap-2 sm:max-w-sm sm:flex-row sm:justify-end">
                    {role === "ra" && <Link href="/dashboard" onClick={rememberCompletion} className={buttonVariants({ variant: "outline", className: "h-11 active:scale-[0.98]" })}><LayoutDashboard className="h-4 w-4" />{text.openDashboard}</Link>}
                    <Link href="/" onClick={rememberCompletion} className={buttonVariants({ className: "h-11 active:scale-[0.98]" })}><Home className="h-4 w-4" />{text.openHome}</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-border/70 px-4 py-3" aria-label={text.step.replace("{current}", String(index + 1)).replace("{total}", String(steps.length))}>
          {steps.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => setIndex(itemIndex)} aria-label={`${itemIndex + 1}. ${item.label}`} aria-current={itemIndex === index ? "step" : undefined} className={cn("h-2 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none", itemIndex === index ? "w-7 bg-primary" : itemIndex < index ? "w-2 bg-primary/40" : "w-2 bg-muted")} />)}
        </div>
      </section>
    </div>
  );
}
