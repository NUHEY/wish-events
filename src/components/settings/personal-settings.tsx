"use client";
import Link from "next/link";
import { ArrowLeft, Moon, Sun, UserRound, CircleHelp } from "lucide-react";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useLocale } from "@/lib/i18n/locale-provider";
import { useTheme } from "@/components/layout/theme-provider";
import { Button, buttonVariants } from "@/components/ui/button";
export function PersonalSettings({signedIn, resident}: {signedIn:boolean; resident:boolean}) {
 const en=useLocale()==="en";
 const {theme,setTheme}=useTheme();
 return <div className="mx-auto max-w-xl space-y-5"><Link href={signedIn?"/":"/login"} className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>{signedIn?(en?"Home":"ホームへ"):(en?"Back to login":"ログインへ戻る")}</Link><header><h1 className="text-2xl font-bold">{en?"Your settings":"自分の設定"}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{en?"Language and appearance are saved on this browser immediately.":"言語と表示の変更は、このブラウザにすぐに保存されます。"}</p></header>
 <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">言語 / Language</h2><LocaleToggle/></div><div className="space-y-3 border-t border-border pt-5"><h2 className="font-semibold">{en?"Appearance":"画面の明るさ"}</h2><div role="group" aria-label={en?"Appearance":"画面の明るさ"} className="grid grid-cols-2 gap-2">{(["light","dark"] as const).map(value=><Button key={value} type="button" variant={theme===value?"default":"outline"} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{value==="light"?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}{value==="light"?(en?"Light":"ライト"):(en?"Dark":"ダーク")}</Button>)}</div></div></section>
 {signedIn&&<section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="font-semibold">{en?"Profile & help":"プロフィール・使い方"}</h2>{resident&&<Link href="/profile/edit" className={buttonVariants({variant:"outline",className:"w-full justify-start whitespace-normal text-left h-auto min-h-11 py-3"})}><UserRound className="h-4 w-4"/>{en?"Profile and information visibility":"プロフィールと公開範囲"}</Link>}<Link href="/onboarding" className={buttonVariants({variant:"outline",className:"w-full justify-start"})}><CircleHelp className="h-4 w-4"/>{en?"How to use WISH Events":"使い方ガイド"}</Link></section>}
 </div>;
}
