"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, QrCode, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareLinkButton({ title, path }: { title: string; path: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 264,
      margin: 2,
      color: { dark: "#241F22", light: "#FFFFFF" },
    });
  }, [open, url]);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch {
        return;
      }
    }
    await copy();
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadQr() {
    const anchor = document.createElement("a");
    anchor.download = `${title.replace(/[^\p{L}\p{N}-]+/gu, "-")}-qr.png`;
    anchor.href = canvasRef.current?.toDataURL("image/png") ?? "";
    anchor.click();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />共有
      </Button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/35 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="ページを共有">
          <button className="absolute inset-0" onClick={() => setOpen(false)} aria-label="閉じる" />
          <section className="relative w-full max-w-sm rounded-t-3xl border border-border bg-card p-5 shadow-elevated sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-bold text-primary">SHARE</p><h2 className="mt-1 text-lg font-bold">このページを共有</h2></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-secondary p-2" aria-label="閉じる"><X className="h-4 w-4" /></button>
            </div>
            <div className="mx-auto mt-4 w-fit rounded-2xl border border-border bg-white p-3 shadow-sm"><canvas ref={canvasRef} className="h-[264px] w-[264px] max-w-full" /></div>
            <p className="mt-3 truncate rounded-xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{url}</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Button type="button" variant="secondary" className="h-auto flex-col py-3 text-xs" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "コピー済み" : "URLコピー"}</Button>
              <Button type="button" variant="secondary" className="h-auto flex-col py-3 text-xs" onClick={downloadQr}><Download className="h-4 w-4" />QR保存</Button>
              <Button type="button" className="h-auto flex-col py-3 text-xs" onClick={share}><QrCode className="h-4 w-4" />共有する</Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
