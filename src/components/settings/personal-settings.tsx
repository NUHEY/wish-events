"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, CircleHelp, DoorOpen, Languages, Palette, Type } from "lucide-react";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useTheme } from "@/components/layout/theme-provider";
import { Button } from "@/components/ui/button";
import { SettingSelect } from "@/components/settings/setting-select";
import type { ThemePreference, TextSize } from "@/lib/theme";

export function PersonalSettings({ signedIn, resident }: { signedIn: boolean; resident: boolean }) {
  const en = useLocale() === "en";
  const { themePreference, setTheme, textSize, setTextSize, reducedMotion, setReducedMotion } = useTheme();
  const rowClass = "flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={signedIn ? "/" : "/login"} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        {signedIn ? (en ? "Home" : "ホームへ") : (en ? "Back to login" : "ログインへ戻る")}
      </Link>
      <header>
        <h1 className="text-2xl font-bold">{en ? "Your settings" : "自分の設定"}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {en ? "Changes are saved automatically for this browser." : "変更は、このブラウザに自動で保存されます。"}
        </p>
      </header>
      <section aria-label={en ? "Display preferences" : "表示の設定"} className="space-y-5 rounded-2xl bg-card p-4 shadow-card sm:p-5">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium"><Languages aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{en ? "Language" : "言語"}</h2>
          <LocaleToggle />
        </div>
        <div className="space-y-2">
          <label htmlFor="personal-theme" className="flex items-center gap-2 text-sm font-medium"><Palette aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{en ? "Theme" : "テーマ"}</label>
          <SettingSelect id="personal-theme" value={themePreference} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
            <option value="system">{en ? "Use device setting" : "端末に合わせる"}</option>
            <option value="light">{en ? "Light" : "ライト"}</option>
            <option value="dark">{en ? "Dark" : "ダーク"}</option>
          </SettingSelect>
        </div>
        <div className="space-y-2">
          <label htmlFor="personal-text-size" className="flex items-center gap-2 text-sm font-medium"><Type aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{en ? "Text size" : "文字サイズ"}</label>
          <SettingSelect id="personal-text-size" value={textSize} onChange={(event) => setTextSize(event.target.value as TextSize)}>
            <option value="standard">{en ? "Standard" : "標準"}</option>
            <option value="large">{en ? "Larger" : "大きめ"}</option>
          </SettingSelect>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-4">
            <h2 id="personal-motion-label" className="text-sm font-medium">{en ? "Reduce motion" : "動きを控えめにする"}</h2>
            <Button type="button" role="switch" aria-checked={reducedMotion} aria-labelledby="personal-motion-label" variant={reducedMotion ? "secondary" : "outline"} className="min-w-16 shrink-0" onClick={() => setReducedMotion(!reducedMotion)}>
              {reducedMotion ? (en ? "On" : "オン") : (en ? "Off" : "オフ")}
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {en ? "Reduce animations and smooth scrolling. Starts with your device preference." : "アニメーションや滑らかなスクロールを抑えます。初めは端末の設定に合わせます。"}
          </p>
        </div>
      </section>
      {signedIn && (
        <section aria-labelledby="personal-help-heading" className="space-y-2">
          <h2 id="personal-help-heading" className="px-3 text-xs font-medium text-muted-foreground">{en ? "Help & account" : "使い方・アカウント"}</h2>
          <div className="space-y-1">
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
