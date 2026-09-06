"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { BrandTitle, type BrandAnimation } from "@/components/layout/brand-title";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function BrandMotionSettings({ enabled: initialEnabled, style: initialStyle, interval: initialInterval }: { enabled: boolean; style: BrandAnimation; interval: number }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [style, setStyle] = useState(initialStyle);
  const [interval, setInterval] = useState(initialInterval);
  const [preview, setPreview] = useState(0);
  return <section id="brand-motion" className="scroll-mt-24 space-y-4 border-t border-border pt-4">
    <div><h2 className="font-bold">WISH Eventsの動き</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">タイトルに短いアニメーションを時々入れます。「動きを控えめにする」設定中は動きません。</p></div>
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" name="brand_animation_enabled" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-5 w-5 accent-primary" />タイトルをアニメーションする</label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-xs font-medium">種類<Select name="brand_animation_style" value={style} onChange={event => { setStyle(event.target.value as BrandAnimation); setPreview(value => value + 1); }}><option value="underline">ラインがすっと流れる</option><option value="shine">光がやさしく通る</option><option value="lift">ふわっと浮かぶ</option></Select></label>
      <label className="grid gap-1.5 text-xs font-medium">動く間隔<Select name="brand_animation_interval_seconds" value={interval} onChange={event => setInterval(Number(event.target.value))}>{[20,30,45,60,90,120].map(seconds => <option key={seconds} value={seconds}>{seconds}秒ごと{seconds === 45 ? "（標準）" : ""}</option>)}</Select></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/35 px-4 py-3">
      <BrandTitle key={`${style}-${enabled}-${preview}`} animation={enabled ? style : "none"} intervalSeconds={interval} preview />
      <Button type="button" variant="ghost" size="sm" disabled={!enabled} onClick={() => setPreview(value => value + 1)}><Play aria-hidden="true" className="h-3.5 w-3.5" />プレビュー</Button>
    </div>
  </section>;
}
