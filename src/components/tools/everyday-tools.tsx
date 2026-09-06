"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Calculator, Globe2, Shuffle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { splitBill, makeGroups } from "@/lib/everyday-tools";
import { useLocale } from "@/lib/i18n/locale-provider";

const CITIES = [
  ["Asia/Tokyo", "東京", "Tokyo"], ["Asia/Seoul", "ソウル", "Seoul"], ["Asia/Shanghai", "上海", "Shanghai"],
  ["Asia/Kolkata", "ニューデリー", "New Delhi"], ["Europe/London", "ロンドン", "London"],
  ["Europe/Paris", "パリ", "Paris"], ["America/New_York", "ニューヨーク", "New York"],
  ["America/Los_Angeles", "ロサンゼルス", "Los Angeles"], ["Australia/Sydney", "シドニー", "Sydney"],
] as const;

export function EverydayTool({ kind }: { kind: "split-bill" | "groups" | "world-clock" }) {
  const en = useLocale() === "en";
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("2");
  const [names, setNames] = useState("");
  const [groups, setGroups] = useState<string[][]>([]);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (kind !== "world-clock") return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, [kind]);
  const members = names.split("\n").map(n => n.trim()).filter(Boolean);
  const result = total.trim() && count.trim() ? splitBill(Number(total), Number(count)) : null;
  const titles = { "split-bill": en ? "Split a bill" : "割り勘", groups: en ? "Make groups" : "グループ分け", "world-clock": en ? "World clock" : "世界の時間" };
  const Icon = kind === "split-bill" ? Calculator : kind === "groups" ? Shuffle : Globe2;
  return <div className="mx-auto max-w-xl space-y-5">
    <Link href="/tools" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />{en ? "Tools" : "ツール"}</Link>
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><Icon className="h-6 w-6 text-primary" />{titles[kind]}</h1><p className="mt-2 text-sm text-muted-foreground">{en ? "Works in this browser. Entries are not saved or sent." : "入力内容は保存・送信されず、この画面だけで使えます。"}</p></header>
    {kind === "split-bill" && <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2"><Label htmlFor="bill-total">{en ? "Total (JPY)" : "合計金額（円）"}</Label><Input id="bill-total" type="number" inputMode="numeric" min={0} max={1000000000} step={1} value={total} onChange={e => setTotal(e.target.value)} /></div>
      <div className="grid gap-2"><Label htmlFor="bill-count">{en ? "People (1–100)" : "人数（1〜100人）"}</Label><Input id="bill-count" type="number" inputMode="numeric" min={1} max={100} step={1} value={count} onChange={e => setCount(e.target.value)} /></div>
      <div aria-live="polite" className="rounded-lg bg-secondary/50 p-4">{result ? <><p className="text-2xl font-bold tabular-nums">¥{result.base.toLocaleString()}<span className="ml-2 text-sm font-normal">{en ? "per person" : "/ 人"}</span></p><p className="mt-2 text-sm">{result.extra ? (en ? `${result.extra} people pay ¥${(result.base + 1).toLocaleString()}; the other ${result.count - result.extra} pay ¥${result.base.toLocaleString()}.` : `${result.extra}人は${(result.base + 1).toLocaleString()}円、残り${result.count - result.extra}人は${result.base.toLocaleString()}円で合計が揃います。`) : en ? "Split equally, with no remainder." : "端数なしで均等に分けられます。"}</p></> : <p className="text-sm text-muted-foreground">{en ? "Enter a whole amount and a valid number of people." : "合計金額と人数を整数で入力してください。"}</p>}</div>
    </section>}
    {kind === "groups" && <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="grid gap-2"><Label htmlFor="group-names">{en ? "Names, one per line (up to 100)" : "参加者（1行に1人・100人まで）"}</Label><Textarea id="group-names" rows={5} maxLength={5000} value={names} onChange={e => { setNames(e.target.value); setGroups([]); }} placeholder={en ? "Haruka\nAlex\nMina" : "はるか\nアレックス\nミナ"} /></div>
      <div className="grid gap-2"><Label htmlFor="group-count">{en ? "Number of groups" : "グループ数"}</Label><Input id="group-count" type="number" inputMode="numeric" min={1} max={members.length || 1} value={count} onChange={e => { setCount(e.target.value); setGroups([]); }} /></div>
      <Button className="w-full" disabled={members.length > 100 || !Number.isInteger(Number(count)) || Number(count) < 1 || Number(count) > members.length} onClick={() => setGroups(makeGroups(members, Number(count)))}><Shuffle className="h-4 w-4" />{en ? "Shuffle into groups" : "ランダムに分ける"}</Button>
      <div aria-live="polite" className="grid gap-3 sm:grid-cols-2">{groups.map((members, i) => <div key={i} className="min-w-0 rounded-lg bg-secondary/50 p-3"><h2 className="text-sm font-bold">{en ? "Group" : "グループ"} {i + 1}</h2><ul className="mt-2 space-y-1 text-sm">{members.map((name,j) => <li key={j} className="break-words [overflow-wrap:anywhere]">{name}</li>)}</ul></div>)}</div>
    </section>}
    {kind === "world-clock" && <section className="grid gap-3 sm:grid-cols-2">{CITIES.map(([zone,ja,label]) => <div key={zone} className="min-w-0 rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">{en ? label : ja}</h2><p className="mt-2 text-2xl font-bold tabular-nums">{now ? new Intl.DateTimeFormat(en ? "en-GB" : "ja-JP", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle:"h23" }).format(now) : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{now ? new Intl.DateTimeFormat(en ? "en-US" : "ja-JP", { timeZone: zone, month:"short",day:"numeric",weekday:"short" }).format(now) : "—"}</p></div>)}</section>}
  </div>;
}
