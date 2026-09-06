"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, CircleHelp, DoorOpen, Moon, Sun } from "lucide-react";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useTheme } from "@/components/layout/theme-provider";
import { Button } from "@/components/ui/button";

export function PersonalSettings({ signedIn, resident }: { signedIn: boolean; resident: boolean }) {
  const en = useLocale() === "en";
  const { theme, setTheme, reducedMotion, setReducedMotion } = useTheme();
  const rowClass = "flex min-h-11 items-center gap-3 rounded-lg py-3 text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link href={signedIn ? "/" : "/login"} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        {signedIn ? (en ? "Home" : "ホームへ") : (en ? "Back to login" : "ログインへ戻る")}
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{en ? "Your settings" : "自分の設定"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {en ? "Language and appearance are saved immediately for this browser only." : "言語と表示の変更は、自分のブラウザだけにすぐに保存されます。"}
        </p>
      </header>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="font-semibold">言語 / Language</h2>
          <LocaleToggle />
        </div>
        <div className="space-y-3 border-t border-border pt-5">
          <h2 className="font-semibold">{en ? "Appearance" : "画面の明るさ"}</h2>
          <div role="group" aria-label={en ? "Appearance" : "画面の明るさ"} className="grid grid-cols-2 gap-2">
            {(["light", "dark"] as const).map(value => (
              <Button key={value} type="button" variant={theme === value ? "default" : "outline"} aria-pressed={theme === value} onClick={() => setTheme(value)}>
                {value === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {value === "light" ? (en ? "Light" : "ライト") : (en ? "Dark" : "ダーク")}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="personal-motion-label" className="font-semibold">{en ? "Reduce motion" : "動きを控えめにする"}</h2>
            <Button type="button" role="switch" aria-checked={reducedMotion} aria-labelledby="personal-motion-label" variant={reducedMotion ? "default" : "outline"} className="min-w-16 shrink-0" onClick={() => setReducedMotion(!reducedMotion)}>
              {reducedMotion ? (en ? "On" : "オン") : (en ? "Off" : "オフ")}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {en ? "Reduce animations and smooth scrolling. Starts with your device preference." : "アニメーションや滑らかなスクロールを抑えます。初めは端末の設定に合わせます。"}
          </p>
        </div>
      </section>
      {signedIn && (
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="mb-2 font-semibold">{en ? "Help & account" : "使い方・アカウント"}</h2>
          <div className="divide-y divide-border">
            <Link href="/onboarding" className={rowClass}>
              <CircleHelp aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">{en ? "How to use WISH Events" : "使い方ガイド"}</span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
            {resident && (
              <Link href="/move-out" className={rowClass}>
                <DoorOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{en ? "Moving out" : "退寮の手続き"}</span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
