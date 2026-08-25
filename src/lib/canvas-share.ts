"use client";

/**
 * イベント情報の共有画像・退寮カードで共通して使うCanvas系ユーティリティ。
 * すべてブラウザ内で完結する（サーバーへの画像生成リクエストは発生しない）。
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 日本語（文字単位の折り返しで十分自然）・英語（単語単位）の両方に
 * それなりに対応する簡易な折り返し描画。厳密な国際化対応はスコープ外。
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
): number {
  const hasSpaces = /\s/.test(text);
  const units = hasSpaces ? text.split(/(\s+)/) : text.split("");

  let line = "";
  let lines: string[] = [];

  for (const unit of units) {
    const test = line + unit;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = unit.trimStart();
    } else {
      line = test;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line.trimEnd());

  if (lines.length === maxLines) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last + "…").width > maxWidth) {
      lines[maxLines - 1] = last.slice(0, -1) + "…";
    }
  }

  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob failed"));
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * LINEのQRコードなど、既に画像として存在するURLをフェッチしてそのまま
 * ファイルとして保存する。スクリーンショットに頼らず、劣化のない元画像を
 * 直接ダウンロードできるようにするための共通処理。
 */
export async function fetchAndDownloadImage(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

/**
 * 可能ならOS標準の共有シート（インスタのストーリーへの共有等を含む）を開き、
 * 使えない環境（多くのデスクトップブラウザ等）ではPNGダウンロードにフォールバックする。
 */
export async function shareOrDownloadImage(blob: Blob, filename: string, shareTitle: string) {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareTitle });
      return;
    } catch {
      // ユーザーが共有シートをキャンセルした場合など。ダウンロードにフォールバックしない
      // （キャンセルしたのに勝手にダウンロードが始まると驚かれるため）。
      return;
    }
  }

  downloadBlob(blob, filename);
}
