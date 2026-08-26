"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PartyPopper, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { drawRoundedRect, wrapText, canvasToBlob, shareOrDownloadImage } from "@/lib/canvas-share";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import type { MoveOutEvent } from "@/components/move-out/move-out-confirm";

/**
 * 退寮後の記念ページ。参加履歴からの簡単な統計と、5種類のデザインの
 * 「退寮カード」（インスタのストーリー比率 9:16）をCanvasで生成し、
 * OS標準の共有シート（Web Share API）またはPNGダウンロードで共有できる。
 */

const W = 1080;
const H = 1920;

const STYLE_KEYS = ["wine", "polaroid", "ticket", "neon", "memphis"] as const;
type StyleKey = (typeof STYLE_KEYS)[number];

type Stats = {
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  categoryCount: number;
};

function computeStats(events: MoveOutEvent[]): Stats {
  if (events.length === 0) {
    return { count: 0, firstDate: null, lastDate: null, categoryCount: 0 };
  }
  const sorted = [...events].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
  );
  return {
    count: events.length,
    firstDate: sorted[0].event_date,
    lastDate: sorted[sorted.length - 1].event_date,
    categoryCount: new Set(events.map((e) => e.category)).size,
  };
}

function formatDateShort(iso: string | null, locale: Locale): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(iso));
}

type RenderCtx = {
  fullName: string | null;
  stats: Stats;
  dict: Dictionary;
  locale: Locale;
};

function displayName(r: RenderCtx): string {
  return r.fullName || (r.locale === "en" ? "WISH Resident" : "WISH生");
}

// ---- スタイル1: ワインレッド（ブランドカラーを踏襲したミニマルデザイン） ----
function renderWine(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const PRIMARY = "#A84F6D";
  const PRIMARY_DARK = "#2A0A15";
  const GOLD = "#F0D9A8";

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, PRIMARY);
  grad.addColorStop(1, PRIMARY_DARK);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.1, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.1, H * 0.92, 380, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  drawRoundedRect(ctx, 90, 120, 96, 96, 24);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = "700 48px sans-serif";
  ctx.fillText("W", 90 + 48 - ctx.measureText("W").width / 2, 120 + 50);
  ctx.font = "600 32px sans-serif";
  ctx.fillText("WISH Events", 210, 120 + 50);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = GOLD;
  ctx.font = "700 34px sans-serif";
  ctx.fillText(r.locale === "en" ? "GRADUATION" : "退寮記念", 90, 340);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 78px sans-serif";
  wrapText(ctx, displayName(r), 90, 440, W - 180, 92, 2);

  ctx.font = "500 38px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(
    r.locale === "en" ? "Thank you for being part of WISH." : "WISHでの日々をありがとう。",
    90,
    620
  );

  const statY = 820;
  drawRoundedRect(ctx, 90, statY, W - 180, 260, 32);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 90, statY, W - 180, 260, 32);
  ctx.stroke();

  const cols = [
    { label: r.locale === "en" ? "Events" : "参加イベント", value: String(r.stats.count) },
    { label: r.locale === "en" ? "Categories" : "カテゴリー", value: String(r.stats.categoryCount) },
  ];
  const colW = (W - 180) / 2;
  ctx.textAlign = "center";
  cols.forEach((c, i) => {
    const cx = 90 + colW * i + colW / 2;
    ctx.font = "800 72px sans-serif";
    ctx.fillStyle = GOLD;
    ctx.fillText(c.value, cx, statY + 130);
    ctx.font = "500 30px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText(c.label, cx, statY + 190);
  });
  ctx.textAlign = "left";

  ctx.font = "500 32px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(
    `📅 ${formatDateShort(r.stats.firstDate, r.locale)} → ${formatDateShort(r.stats.lastDate, r.locale)}`,
    90,
    statY + 330
  );

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(90, H - 140);
  ctx.lineTo(W - 90, H - 140);
  ctx.stroke();
  ctx.font = "500 30px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Waseda International Student House", 90, H - 85);
}

// ---- スタイル2: ポラロイド風 ----
function renderPolaroid(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const CREAM = "#F6EFE2";
  const INK = "#3A2E22";
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(58,46,34,0.05)";
  for (let y = 40; y < H; y += 60) {
    for (let x = 40; x < W; x += 60) {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(W / 2, H / 2 - 60);
  ctx.rotate(-0.02);
  const cardW = 820;
  const cardH = 1300;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 12);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const photoGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, -cardH / 2 + 820);
  photoGrad.addColorStop(0, "#E8B4B8");
  photoGrad.addColorStop(0.5, "#D89A9E");
  photoGrad.addColorStop(1, "#A84F6D");
  ctx.fillStyle = photoGrad;
  ctx.fillRect(-cardW / 2 + 40, -cardH / 2 + 40, cardW - 80, 820);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#F0D9A8";
  ctx.beginPath();
  ctx.arc(cardW / 2 - 160, -cardH / 2 + 180, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = "italic 700 56px cursive";
  ctx.fillText(displayName(r), 0, -cardH / 2 + 950);
  ctx.font = "500 32px sans-serif";
  ctx.fillStyle = "#7A6B58";
  ctx.fillText(r.locale === "en" ? "My time at WISH" : "WISHでの思い出", 0, -cardH / 2 + 1005);

  ctx.font = "700 30px sans-serif";
  ctx.fillStyle = "#A84F6D";
  ctx.fillText(
    r.locale === "en"
      ? `${r.stats.count} events · ${r.stats.categoryCount} categories`
      : `参加${r.stats.count}件 ・ ${r.stats.categoryCount}カテゴリー`,
    0,
    -cardH / 2 + 1090
  );
  ctx.font = "500 26px sans-serif";
  ctx.fillStyle = "#9A8B76";
  ctx.fillText(
    `${formatDateShort(r.stats.firstDate, r.locale)} - ${formatDateShort(r.stats.lastDate, r.locale)}`,
    0,
    -cardH / 2 + 1140
  );
  ctx.textAlign = "left";
  ctx.restore();

  function tape(cx: number, cy: number, rotate: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotate);
    ctx.fillStyle = "rgba(240,217,168,0.85)";
    ctx.fillRect(-70, -22, 140, 44);
    ctx.restore();
  }
  tape(W / 2 - 300, H / 2 - 660, -0.6);
  tape(W / 2 + 300, H / 2 - 660, 0.6);

  ctx.textAlign = "center";
  ctx.font = "600 30px sans-serif";
  ctx.fillStyle = "#7A6B58";
  ctx.fillText("WISH · Waseda International Student House", W / 2, H - 90);
  ctx.textAlign = "left";
}

// ---- スタイル3: チケット / 搭乗券風 ----
function renderTicket(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const NAVY = "#0F1B2D";
  const NAVY_LIGHT = "#16273D";
  const GOLD = "#D4AF37";
  const MONO = "'Courier New', monospace";

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);

  const marginX = 80;
  const ticketW = W - marginX * 2;
  const ticketTop = 220;
  const ticketH = H - ticketTop - 220;
  const stubH = 340;

  ctx.fillStyle = NAVY_LIGHT;
  drawRoundedRect(ctx, marginX, ticketTop, ticketW, ticketH, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(212,175,55,0.5)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, marginX + 16, ticketTop + 16, ticketW - 32, ticketH - 32, 20);
  ctx.stroke();

  ctx.fillStyle = GOLD;
  ctx.font = `700 30px ${MONO}`;
  ctx.fillText(r.locale === "en" ? "BOARDING PASS" : "退寮チケット", marginX + 60, ticketTop + 100);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 30px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText("WISH", marginX + ticketW - 60, ticketTop + 100);
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${MONO}`;
  wrapText(ctx, displayName(r).toUpperCase(), marginX + 60, ticketTop + 210, ticketW - 120, 76, 2);

  const perfY = ticketTop + ticketH - stubH;
  ctx.beginPath();
  ctx.setLineDash([14, 14]);
  ctx.strokeStyle = "rgba(212,175,55,0.6)";
  ctx.lineWidth = 3;
  ctx.moveTo(marginX + 40, perfY);
  ctx.lineTo(marginX + ticketW - 40, perfY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = NAVY;
  ctx.beginPath();
  ctx.arc(marginX, perfY, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(marginX + ticketW, perfY, 26, 0, Math.PI * 2);
  ctx.fill();

  const rows: Array<[string, string]> = [
    [r.locale === "en" ? "EVENTS" : "参加イベント", String(r.stats.count)],
    [r.locale === "en" ? "CATEGORIES" : "カテゴリー", String(r.stats.categoryCount)],
    [r.locale === "en" ? "FROM" : "はじめて", formatDateShort(r.stats.firstDate, r.locale)],
    [r.locale === "en" ? "TO" : "さいご", formatDateShort(r.stats.lastDate, r.locale)],
  ];
  let ry = perfY + 90;
  ctx.font = `600 28px ${MONO}`;
  rows.forEach(([label, value]) => {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(label, marginX + 60, ry);
    ctx.fillStyle = GOLD;
    ctx.textAlign = "right";
    ctx.fillText(value, marginX + ticketW - 60, ry);
    ctx.textAlign = "left";
    ry += 56;
  });

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText("WASEDA INTERNATIONAL STUDENT HOUSE", marginX + 60, H - 130);
}

// ---- スタイル4: ネオン ----
function renderNeon(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  ctx.fillStyle = "#0A0714";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.35, 50, W / 2, H * 0.35, 800);
  glow.addColorStop(0, "rgba(255,46,157,0.35)");
  glow.addColorStop(1, "rgba(10,7,20,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(0,240,255,0.15)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, H * 0.7);
    ctx.lineTo(W / 2 + (x - W / 2) * 0.2, H);
    ctx.stroke();
  }

  const neonText = (text: string, x: number, y: number, size: number, color: string) => {
    ctx.font = `800 ${size}px sans-serif`;
    ctx.shadowColor = color;
    ctx.shadowBlur = 30;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  };

  neonText(r.locale === "en" ? "SO LONG, WISH" : "SEE YOU, WISH", 90, 420, 78, "#00F0FF");

  ctx.font = "800 66px sans-serif";
  ctx.shadowColor = "#FF2E9A";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#FF2E9A";
  wrapText(ctx, displayName(r), 90, 540, W - 180, 78, 2);
  ctx.shadowBlur = 0;

  const capY = 900;
  const caps: Array<[string, string, string]> = [
    [String(r.stats.count), r.locale === "en" ? "EVENTS" : "参加イベント", "#00F0FF"],
    [String(r.stats.categoryCount), r.locale === "en" ? "CATEGORIES" : "カテゴリー", "#FF2E9A"],
  ];
  const capW = (W - 180 - 30) / 2;
  ctx.textAlign = "center";
  caps.forEach(([value, label, color], i) => {
    const x = 90 + i * (capW + 30);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, x, capY, capW, 260, 28);
    ctx.stroke();
    ctx.font = "800 76px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + capW / 2, capY + 140);
    ctx.font = "600 26px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(label, x + capW / 2, capY + 195);
  });
  ctx.textAlign = "left";

  ctx.font = "500 30px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(
    `${formatDateShort(r.stats.firstDate, r.locale)} — ${formatDateShort(r.stats.lastDate, r.locale)}`,
    90,
    capY + 340
  );

  ctx.font = "600 28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("WISH · WASEDA", 90, H - 100);
}

// ---- スタイル5: メンフィス（ポップな幾何学模様） ----
function renderMemphis(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const INK = "#3A2E22";
  ctx.fillStyle = "#FFF6E5";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#FF6B6B";
  ctx.beginPath();
  ctx.arc(120, 220, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4ECDC4";
  drawRoundedRect(ctx, W - 260, 140, 140, 140, 24);
  ctx.fill();

  ctx.fillStyle = "#FFD93D";
  ctx.beginPath();
  ctx.moveTo(W - 140, 420);
  ctx.lineTo(W - 40, 560);
  ctx.lineTo(W - 240, 560);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(140, H - 260, 90, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#A84F6D";
  ctx.beginPath();
  ctx.arc(W - 150, H - 500, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  for (let i = 0; i < 24; i++) {
    const x = 60 + ((i * 137) % (W - 120));
    const y = 700 + ((i * 251) % (H - 900));
    ctx.beginPath();
    ctx.arc(x, y, i % 3 === 0 ? 6 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = INK;
  ctx.font = "900 44px sans-serif";
  ctx.fillText(r.locale === "en" ? "MOVED OUT!" : "退寮しました！", 90, 380);

  ctx.font = "900 78px sans-serif";
  wrapText(ctx, displayName(r), 90, 500, W - 180, 90, 2);

  const cardY = 880;
  const cardW = (W - 180 - 30) / 2;
  const cardData = [
    { bg: "#4ECDC4", value: String(r.stats.count), label: r.locale === "en" ? "Events" : "参加イベント" },
    { bg: "#FF6B6B", value: String(r.stats.categoryCount), label: r.locale === "en" ? "Categories" : "カテゴリー" },
  ];
  ctx.textAlign = "center";
  cardData.forEach((c, i) => {
    const x = 90 + i * (cardW + 30);
    ctx.fillStyle = c.bg;
    drawRoundedRect(ctx, x, cardY, cardW, 260, 28);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    drawRoundedRect(ctx, x, cardY, cardW, 260, 28);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = "900 76px sans-serif";
    ctx.fillText(c.value, x + cardW / 2, cardY + 140);
    ctx.font = "700 28px sans-serif";
    ctx.fillText(c.label, x + cardW / 2, cardY + 195);
  });
  ctx.textAlign = "left";

  ctx.font = "700 30px sans-serif";
  ctx.fillStyle = INK;
  ctx.fillText(
    `${formatDateShort(r.stats.firstDate, r.locale)} → ${formatDateShort(r.stats.lastDate, r.locale)}`,
    90,
    cardY + 340
  );

  ctx.font = "700 26px sans-serif";
  ctx.fillStyle = "#7A6B58";
  ctx.fillText("WISH · Waseda International Student House", 90, H - 90);
}

const RENDERERS: Record<StyleKey, (ctx: CanvasRenderingContext2D, r: RenderCtx) => void> = {
  wine: renderWine,
  polaroid: renderPolaroid,
  ticket: renderTicket,
  neon: renderNeon,
  memphis: renderMemphis,
};

export function MoveOutCelebration({
  fullName,
  events,
}: {
  fullName: string | null;
  events: MoveOutEvent[];
}) {
  const dict = useDict();
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<StyleKey>("wine");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(events), [events]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    RENDERERS[style](ctx, { fullName, stats, dict, locale });
  }, [style, fullName, stats, dict, locale]);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(null);
    setPending(true);
    try {
      const blob = await canvasToBlob(canvas);
      await shareOrDownloadImage(blob, `wish-moveout-${style}.png`, dict.moveOut.celebrationTitle);
    } catch {
      setError(dict.moveOut.shareError);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <PartyPopper className="h-7 w-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{dict.moveOut.celebrationTitle}</h1>
        <p className="text-sm text-muted-foreground">
          {dict.moveOut.celebrationSubtitle.replace("{name}", fullName ?? "")}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{dict.moveOut.noEventsNote}</p>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="grid grid-cols-3 gap-3 p-5 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{stats.count}</p>
              <p className="text-xs text-muted-foreground">{dict.moveOut.statsEventsLabel}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{stats.categoryCount}</p>
              <p className="text-xs text-muted-foreground">{dict.moveOut.statsCategoriesLabel}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">
                {stats.firstDate ? formatDateShort(stats.firstDate, locale) : "-"}
              </p>
              <p className="text-xs text-muted-foreground">{dict.moveOut.statsFirstLabel}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{dict.moveOut.styleSectionTitle}</p>
        <div className="flex flex-wrap gap-2">
          {STYLE_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={style === key ? "default" : "outline"}
              onClick={() => setStyle(key)}
            >
              {dict.moveOut.styleNames[key]}
            </Button>
          ))}
        </div>

        <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-border shadow-card">
          <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: `${W} / ${H}` }} />
        </div>

        {error && <p className="text-center text-sm text-destructive">{error}</p>}

        <Button onClick={handleShare} disabled={pending} className="self-center">
          <Share2 className="h-4 w-4" />
          {pending ? dict.moveOut.shareGenerating : dict.moveOut.shareButton}
        </Button>
      </div>

      <Link
        href="/"
        className="self-center text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {dict.moveOut.backHomeLink}
      </Link>
    </>
  );
}
