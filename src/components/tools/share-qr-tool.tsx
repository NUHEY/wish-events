"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, Download, QrCode } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/lib/i18n/locale-provider";
export function ShareQrTool() {
  const en = useLocale() === "en";
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{image:string;url:string}|null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function generate() {
    if (busy.current) return;
    setError(""); setResult(null);
    let parsed: URL;
    try { parsed = new URL(url.trim()); if (!["https:","http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); }
    catch { setError(en ? "Enter an http or https link without a password." : "http または https で始まる、パスワードを含まないURLを入力してください。"); return; }
    if (parsed.href.length > 2000) { setError(en ? "This link is too long. Use a shorter link." : "URLが長すぎます。短いURLを使ってください。"); return; }
    busy.current = true; setPending(true);
    try { const qr = await import("qrcode"); const image = await qr.toDataURL(parsed.href,{width:768,margin:4,errorCorrectionLevel:"M",color:{dark:"#17202A",light:"#FFFFFF"}}); setResult({image,url:parsed.href}); }
    catch { setError(en ? "Could not create the QR code. Please try again." : "QRコードを作成できませんでした。もう一度お試しください。"); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="mx-auto max-w-lg space-y-5"><Link href="/tools" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>{en?"Tools":"ツールへ"}</Link><header><h1 className="flex items-center gap-2 text-2xl font-bold"><QrCode className="h-6 w-6"/>{en?"Share a QR code":"共有QRコード"}</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{en?"Turn an event or booking link into an image for posters and invitations.":"イベントや予約ページのリンクを、掲示物・案内に使える画像にします。"}</p></header><form onSubmit={e=>{e.preventDefault();void generate();}} className="space-y-3 rounded-xl border border-border bg-card p-4"><Label htmlFor="share-url">{en?"Link to share":"共有するリンク"}</Label><Input id="share-url" type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" required maxLength={2000} value={url} onChange={e=>{setUrl(e.target.value);setResult(null);setError("");}} placeholder="https://…" disabled={pending}/><Button disabled={pending} type="submit" className="w-full">{pending?(en?"Creating…":"作成中…"):(en?"Create QR code":"QRコードを作成")}</Button>{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</form>{result&&<section aria-live="polite" className="space-y-3 rounded-xl border border-border bg-card p-4"><img src={result.image} alt={en?"QR code for the link below":"下のリンクを開くQRコード"} width={256} height={256} className="mx-auto h-auto w-full max-w-64 rounded-lg"/><p className="break-all text-xs text-muted-foreground">{result.url}</p><a href={result.image} download="wish-share-qr.png" className={buttonVariants({variant:"outline",className:"w-full"})}><Download className="h-4 w-4"/>{en?"Save image":"画像を保存"}</a><p className="text-xs leading-relaxed text-muted-foreground">{en?"Login and access permissions still apply. Creating a QR code does not make a private page public.":"読み取り後もログインや閲覧権限が必要です。QRコードを作っても、非公開ページが公開されることはありません。"}</p></section>}</div>;
}
