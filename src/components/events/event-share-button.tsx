"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Link2, QrCode, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawRoundedRect, wrapText, canvasToBlob, shareOrDownloadImage } from "@/lib/canvas-share";
import { formatEventDateTime } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

const W = 1080;
const H = 1350;
// Waseda wine red（globals.cssの--primary/--primary-hoverを16進化した値）
const PRIMARY = "#8E1728";
const PRIMARY_DARK = "#61101B";
const GOLD = "#E8CF9A";

async function renderEventShareImage(opts: {
  title: string;
  categoryLabel: string;
  dateText: string;
  location: string | null;
  audience: string | null;
  feeText: string | null;
}): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // 背景: 斜めグラデーション + 装飾円
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, PRIMARY);
  grad.addColorStop(1, PRIMARY_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W * 0.9, H * 0.08, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.05, H * 0.95, 340, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ロゴマーク
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  drawRoundedRect(ctx, 80, 90, 88, 88, 22);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 44px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("W", 80 + 44 - ctx.measureText("W").width / 2, 90 + 46);
  ctx.font = "600 30px sans-serif";
  ctx.fillText("WISH Events", 190, 90 + 46);

  // カテゴリバッジ
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 30px sans-serif";
  const catPadX = 28;
  const catW = ctx.measureText(opts.categoryLabel).width + catPadX * 2;
  drawRoundedRect(ctx, 80, 260, catW, 64, 32);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = PRIMARY_DARK;
  ctx.fillText(opts.categoryLabel, 80 + catPadX, 260 + 43);

  // タイトル
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 68px sans-serif";
  const titleBottom = wrapText(ctx, opts.title, 80, 430, W - 160, 82, 3);

  // 詳細情報
  let y = Math.max(titleBottom + 60, 620);
  ctx.font = "500 36px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(`📅  ${opts.dateText}`, 80, y);
  y += 56;
  if (opts.location) {
    ctx.fillText(`📍  ${opts.location}`, 80, y);
    y += 56;
  }
  if (opts.audience) {
    ctx.fillText(`👥  ${opts.audience}`, 80, y);
    y += 56;
  }

  if (opts.feeText) {
    ctx.font = "700 34px sans-serif";
    const padX = 26;
    const w = ctx.measureText(opts.feeText).width + padX * 2;
    y += 20;
    drawRoundedRect(ctx, 80, y, w, 60, 30);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillText(opts.feeText, 80 + padX, y + 40);
  }

  // フッター
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, H - 130);
  ctx.lineTo(W - 80, H - 130);
  ctx.stroke();
  ctx.font = "500 28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Waseda International Student House", 80, H - 80);

  return canvas;
}

const QR_W = 900;
const QR_H = 1100;

async function renderEventQrImage(opts: { title: string; url: string }): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = QR_W;
  canvas.height = QR_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, QR_W, QR_H);
  ctx.strokeStyle = "#eee2e6";
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 24, 24, QR_W - 48, QR_H - 48, 32);
  ctx.stroke();

  ctx.fillStyle = "#A84F6D";
  ctx.font = "700 32px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WISH Events", QR_W / 2, 100);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "800 42px sans-serif";
  wrapText(ctx, opts.title, QR_W / 2, 170, QR_W - 160, 52, 2);

  const qrCanvas = await QRCode.toCanvas(opts.url, {
    width: 620,
    margin: 1,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });
  ctx.drawImage(qrCanvas, (QR_W - 620) / 2, 280, 620, 620);

  ctx.textAlign = "center";
  ctx.font = "500 26px sans-serif";
  ctx.fillStyle = "#7a7178";
  ctx.fillText(opts.url.replace(/^https?:\/\//, ""), QR_W / 2, QR_H - 70);
  ctx.textAlign = "left";

  return canvas;
}

export function EventShareButton({
  eventId,
  title,
  categoryLabel,
  eventDate,
  location,
  audience,
  feeAmount,
}: {
  eventId: string;
  title: string;
  categoryLabel: string;
  eventDate: string;
  location: string | null;
  audience: string | null;
  feeAmount: number | null;
}) {
  const dict = useDict();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [imagePending, setImagePending] = useState(false);
  const [qrPending, setQrPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);

  async function handleImageShare() {
    setError(null);
    setImagePending(true);
    try {
      const canvas = await renderEventShareImage({
        title,
        categoryLabel,
        dateText: formatEventDateTime(eventDate, locale),
        location,
        audience,
        feeText: feeAmount
          ? `${dict.event.feePrefix}${feeAmount.toLocaleString()}${dict.event.feeUnit}`
          : null,
      });
      const blob = await canvasToBlob(canvas);
      await shareOrDownloadImage(blob, `${title}.png`, title);
      setOpen(false);
    } catch {
      setError(dict.event.shareImageError);
    } finally {
      setImagePending(false);
    }
  }

  async function handleQrSave() {
    setError(null);
    setQrPending(true);
    try {
      const url = `${window.location.origin}/events/${eventId}`;
      const canvas = await renderEventQrImage({ title, url });
      const blob = await canvasToBlob(canvas);
      await shareOrDownloadImage(blob, `${title}-qr.png`, title);
      setOpen(false);
    } catch {
      setError(dict.event.shareQrError);
    } finally {
      setQrPending(false);
    }
  }

  async function handleUrlShare() {
    setError(null);
    const url = `${window.location.origin}/events/${eventId}`;
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };

    if (nav.share) {
      try {
        await nav.share({ title, text: title, url });
        setOpen(false);
        return;
      } catch {
        // ユーザーが共有シートをキャンセルした場合など。何もしない。
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
      setOpen(false);
    } catch {
      setError(dict.event.shareUrlError);
    }
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Share2 className="h-3.5 w-3.5" />
        {urlCopied ? dict.event.shareUrlCopied : dict.event.shareButton}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 flex w-56 flex-col gap-0.5 rounded-xl border border-border bg-card p-1.5 shadow-elevated motion-safe:animate-pop-in">
            <button
              type="button"
              onClick={handleUrlShare}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Link2 className="h-4 w-4 text-muted-foreground" />
              {dict.event.shareUrlButton}
            </button>
            <button
              type="button"
              onClick={handleImageShare}
              disabled={imagePending}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <Share2 className="h-4 w-4 text-muted-foreground" />
              {imagePending ? dict.event.shareImageGenerating : dict.event.shareImageButton}
            </button>
            <button
              type="button"
              onClick={handleQrSave}
              disabled={qrPending}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <QrCode className="h-4 w-4 text-muted-foreground" />
              {qrPending ? dict.event.shareQrGenerating : dict.event.shareQrButton}
            </button>
            {error && <p className="px-2.5 pt-1 text-xs text-destructive">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
