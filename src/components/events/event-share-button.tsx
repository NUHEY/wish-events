"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawRoundedRect, wrapText, canvasToBlob, shareOrDownloadImage } from "@/lib/canvas-share";
import { formatEventDateTime } from "@/lib/utils";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

const W = 1080;
const H = 1350;
// Waseda wine red（globals.cssの--primary/--primary-hoverを16進化した値）
const PRIMARY = "#7A2140";
const PRIMARY_DARK = "#3E0F20";
const GOLD = "#F0D9A8";

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

export function EventShareButton({
  title,
  categoryLabel,
  eventDate,
  location,
  audience,
  feeAmount,
}: {
  title: string;
  categoryLabel: string;
  eventDate: string;
  location: string | null;
  audience: string | null;
  feeAmount: number | null;
}) {
  const dict = useDict();
  const locale = useLocale();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPending(true);
    try {
      const canvas = await renderEventShareImage({
        title,
        categoryLabel,
        dateText: formatEventDateTime(eventDate, locale),
        location,
        audience,
        feeText: feeAmount ? `${dict.event.feePrefix}${feeAmount.toLocaleString()}${dict.event.feeUnit}` : null,
      });
      const blob = await canvasToBlob(canvas);
      await shareOrDownloadImage(blob, `${title}.png`, title);
    } catch {
      setError(dict.event.shareImageError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={pending}>
        <Share2 className="h-3.5 w-3.5" />
        {pending ? dict.event.shareImageGenerating : dict.event.shareImageButton}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
