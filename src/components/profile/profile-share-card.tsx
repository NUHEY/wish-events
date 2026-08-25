"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  drawRoundedRect,
  loadImage,
  wrapText,
  canvasToBlob,
  shareOrDownloadImage,
} from "@/lib/canvas-share";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

/**
 * マイページ（ディレクトリのプロフィール詳細）をインスタ映えする画像として
 * 生成し、共有・ダウンロードできるカード。退寮記念カード（MoveOutCelebration）
 * と同じCanvas手法を使い、いつでも・複数のデザインで使えるようにしたもの。
 */

const W = 1080;
const H = 1350; // Instagramの投稿比率（4:5）

const STYLE_KEYS = ["wine", "polaroid", "neon"] as const;
type StyleKey = (typeof STYLE_KEYS)[number];

export type ProfileShareData = {
  fullName: string | null;
  roomText: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  accentHex: string | null;
  badges: { icon: string; label: string }[];
  eventCount: number;
  surveyCount: number;
};

type RenderCtx = {
  data: ProfileShareData;
  avatarImg: HTMLImageElement | null;
  coverImg: HTMLImageElement | null;
  dict: Dictionary;
  locale: Locale;
};

function displayName(r: RenderCtx): string {
  return r.data.fullName || (r.locale === "en" ? "WISH Resident" : "WISH生");
}

function drawAvatar(ctx: CanvasRenderingContext2D, r: RenderCtx, cx: number, cy: number, radius: number, ringColor: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (r.avatarImg) {
    ctx.drawImage(r.avatarImg, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${radius}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayName(r).charAt(0), cx, cy + 6);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();
}

function renderWine(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const primary = r.data.accentHex || "#7A2140";
  const dark = "#2A0A15";
  const gold = "#F0D9A8";

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, primary);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (r.coverImg) {
    const scale = Math.max(W / r.coverImg.width, 460 / r.coverImg.height);
    const width = r.coverImg.width * scale;
    const height = r.coverImg.height * scale;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.drawImage(r.coverImg, (W - width) / 2, (460 - height) / 2, width, height);
    const coverFade = ctx.createLinearGradient(0, 120, 0, 500);
    coverFade.addColorStop(0, "rgba(42,10,21,0.05)");
    coverFade.addColorStop(1, dark);
    ctx.fillStyle = coverFade; ctx.fillRect(0, 0, W, 520);
    ctx.restore();
  }

  // 世界中の寮生とイベントがつながる様子を、地球の軌道とノードで表現する。
  ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
  [180, 250, 320].forEach((radius) => { ctx.beginPath(); ctx.ellipse(W / 2, 350, radius, radius * 0.42, -0.15, 0, Math.PI * 2); ctx.stroke(); });
  [[250,280],[820,260],[180,420],[890,410],[360,160],[720,500]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = gold; ctx.fill(); });
  ctx.restore();

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(W * 0.88, H * 0.1, 280, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  drawRoundedRect(ctx, 80, 80, 84, 84, 22);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.font = "700 42px sans-serif";
  ctx.fillText("W", 80 + 42 - ctx.measureText("W").width / 2, 80 + 44);
  ctx.font = "600 28px sans-serif";
  ctx.fillText("WISH INTERNATIONAL COMMUNITY", 190, 80 + 44);
  ctx.textBaseline = "alphabetic";

  drawAvatar(ctx, r, W / 2, 400, 130, "rgba(255,255,255,0.9)");

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 48px sans-serif";
  ctx.fillText(displayName(r), W / 2, 610);
  ctx.font = "500 32px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(r.data.roomText, W / 2, 660);
  ctx.textAlign = "left";

  const statY = 760;
  drawRoundedRect(ctx, 80, statY, W - 160, 200, 30);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 80, statY, W - 160, 200, 30);
  ctx.stroke();

  const cols = [
    { label: r.dict.directory.statsEvents, value: String(r.data.eventCount) },
    { label: r.dict.directory.statsSurveys, value: String(r.data.surveyCount) },
    { label: r.dict.directory.statsBadges, value: String(r.data.badges.length) },
  ];
  const colW = (W - 160) / 3;
  ctx.textAlign = "center";
  cols.forEach((c, i) => {
    const cx = 80 + colW * i + colW / 2;
    ctx.font = "800 60px sans-serif";
    ctx.fillStyle = gold;
    ctx.fillText(c.value, cx, statY + 100);
    ctx.font = "500 28px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(c.label, cx, statY + 150);
  });
  ctx.textAlign = "left";

  if (r.data.badges.length > 0) {
    ctx.textAlign = "center";
    ctx.font = "56px sans-serif";
    const row = r.data.badges.slice(0, 6).map((b) => b.icon).join("  ");
    ctx.fillText(row, W / 2, statY + 300);
    ctx.textAlign = "left";
  }

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(80, H - 110);
  ctx.lineTo(W - 80, H - 110);
  ctx.stroke();
  ctx.font = "500 28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Waseda International Student House", 80, H - 60);
}

function renderPolaroid(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  const cream = "#F6EFE2";
  const ink = "#3A2E22";
  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W / 2, H / 2 - 30);
  ctx.rotate(-0.02);
  const cardW = 820;
  const cardH = 1150;
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 55;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 12);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const photoGrad = ctx.createLinearGradient(-cardW / 2, -cardH / 2, cardW / 2, -cardH / 2 + 700);
  photoGrad.addColorStop(0, "#E8B4B8");
  photoGrad.addColorStop(1, r.data.accentHex || "#7A2140");
  ctx.fillStyle = photoGrad;
  ctx.fillRect(-cardW / 2 + 40, -cardH / 2 + 40, cardW - 80, 700);
  drawAvatar(ctx, r, 0, -cardH / 2 + 390, 190, "rgba(255,255,255,0.9)");

  ctx.textAlign = "center";
  ctx.fillStyle = ink;
  ctx.font = "italic 700 54px cursive";
  ctx.fillText(displayName(r), 0, -cardH / 2 + 830);
  ctx.font = "500 30px sans-serif";
  ctx.fillStyle = "#7A6B58";
  ctx.fillText(r.data.roomText, 0, -cardH / 2 + 885);

  ctx.font = "700 28px sans-serif";
  ctx.fillStyle = r.data.accentHex || "#7A2140";
  ctx.fillText(
    `${r.data.eventCount} ${r.dict.directory.statsEvents} · ${r.data.badges.length} ${r.dict.directory.statsBadges}`,
    0,
    -cardH / 2 + 950
  );
  if (r.data.badges.length > 0) {
    ctx.font = "44px sans-serif";
    ctx.fillText(r.data.badges.slice(0, 6).map((b) => b.icon).join("  "), 0, -cardH / 2 + 1020);
  }
  ctx.textAlign = "left";
  ctx.restore();

  ctx.textAlign = "center";
  ctx.font = "600 28px sans-serif";
  ctx.fillStyle = "#7A6B58";
  ctx.fillText("WISH · Waseda International Student House", W / 2, H - 80);
  ctx.textAlign = "left";
}

function renderNeon(ctx: CanvasRenderingContext2D, r: RenderCtx) {
  ctx.fillStyle = "#0A0714";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.3, 50, W / 2, H * 0.3, 800);
  glow.addColorStop(0, "rgba(255,46,157,0.32)");
  glow.addColorStop(1, "rgba(10,7,20,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawAvatar(ctx, r, W / 2, 380, 140, "#00F0FF");

  ctx.textAlign = "center";
  ctx.font = "800 60px sans-serif";
  ctx.shadowColor = "#FF2E9A";
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#FF2E9A";
  ctx.fillText(displayName(r), W / 2, 600);
  ctx.shadowBlur = 0;
  ctx.font = "500 30px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(r.data.roomText, W / 2, 650);
  ctx.textAlign = "left";

  const capY = 760;
  const caps: Array<[string, string, string]> = [
    [String(r.data.eventCount), r.dict.directory.statsEvents, "#00F0FF"],
    [String(r.data.surveyCount), r.dict.directory.statsSurveys, "#FF2E9A"],
    [String(r.data.badges.length), r.dict.directory.statsBadges, "#FFD93D"],
  ];
  const gap = 24;
  const capW = (W - 160 - gap * 2) / 3;
  ctx.textAlign = "center";
  caps.forEach(([value, label, color], i) => {
    const x = 80 + i * (capW + gap);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, x, capY, capW, 220, 26);
    ctx.stroke();
    ctx.font = "800 60px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + capW / 2, capY + 115);
    ctx.font = "600 24px sans-serif";
    ctx.fillStyle = color;
    ctx.fillText(label, x + capW / 2, capY + 165);
  });
  ctx.textAlign = "left";

  if (r.data.badges.length > 0) {
    ctx.textAlign = "center";
    ctx.font = "50px sans-serif";
    ctx.fillText(r.data.badges.slice(0, 6).map((b) => b.icon).join("  "), W / 2, capY + 320);
    ctx.textAlign = "left";
  }

  ctx.font = "600 28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.fillText("WISH · WASEDA", 80, H - 80);
}

const RENDERERS: Record<StyleKey, (ctx: CanvasRenderingContext2D, r: RenderCtx) => void> = {
  wine: renderWine,
  polaroid: renderPolaroid,
  neon: renderNeon,
};

function ProfileShareModal({ data, onClose }: { data: ProfileShareData; onClose: () => void }) {
  const dict = useDict();
  const locale = useLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [style, setStyle] = useState<StyleKey>("wine");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarImg, setAvatarImg] = useState<HTMLImageElement | null>(null);
  const [coverImg, setCoverImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!data.avatarUrl) return;
    loadImage(data.avatarUrl)
      .then((img) => {
        if (!cancelled) setAvatarImg(img);
      })
      .catch(() => {
        // 読み込めない場合はイニシャル表示にフォールバックする（renderer側で処理済み）。
      });
    return () => {
      cancelled = true;
    };
  }, [data.avatarUrl]);

  useEffect(() => {
    let cancelled = false;
    if (!data.coverUrl) { setCoverImg(null); return; }
    loadImage(data.coverUrl).then((img) => { if (!cancelled) setCoverImg(img); }).catch(() => setCoverImg(null));
    return () => { cancelled = true; };
  }, [data.coverUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    RENDERERS[style](ctx, { data, avatarImg, coverImg, dict, locale });
  }, [style, data, avatarImg, coverImg, dict, locale]);

  async function handleShare() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(null);
    setPending(true);
    try {
      const blob = await canvasToBlob(canvas);
      await shareOrDownloadImage(blob, `wish-mypage-${style}.png`, dict.profileShare.title);
    } catch {
      setError(dict.profileShare.shareError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-sm flex-col gap-3 overflow-y-auto rounded-2xl bg-card p-4 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{dict.profileShare.title}</p>
          <button type="button" onClick={onClose} aria-label={dict.profileShare.close} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {STYLE_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={style === key ? "default" : "outline"}
              onClick={() => setStyle(key)}
            >
              {dict.profileShare.styleNames[key]}
            </Button>
          ))}
        </div>

        <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-border shadow-card">
          <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: `${W} / ${H}` }} />
        </div>

        {error && <p className="text-center text-xs text-destructive">{error}</p>}

        <Button onClick={handleShare} disabled={pending} className="self-center">
          <Share2 className="h-4 w-4" />
          {pending ? dict.profileShare.shareGenerating : dict.profileShare.shareButton}
        </Button>
      </div>
    </div>
  );
}

export function ProfileShareButton({ data, className }: { data: ProfileShareData; className?: string }) {
  const dict = useDict();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Share2 className="h-3.5 w-3.5" />
        {dict.directory.shareProfileButton}
      </Button>
      {open && <ProfileShareModal data={data} onClose={() => setOpen(false)} />}
    </>
  );
}
