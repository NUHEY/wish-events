"use client";

/**
 * トーク/DMへの画像添付前にブラウザ側でリサイズ・再圧縮する。
 *
 * スマホのカメラ写真はそのまま送ると1枚あたり数MB〜十数MBになりがちで、
 * Supabase Storageの無料枠（1GB）・egress（5GB/月）を800人超の寮生が
 * 使うと想像以上に早く消費してしまう。長辺を最大1600pxに縮小し、
 * JPEGで再エンコードすることで、見た目の劣化をほぼ気にならない範囲に
 * 抑えつつファイルサイズを大幅に削減する（写真1枚あたり概ね1/3〜1/10）。
 *
 * GIFはアニメーションが壊れるため対象外。それ以外（HEIC等ブラウザが
 * デコードできない形式や、圧縮に失敗した場合）は元のファイルをそのまま返す
 * （送信自体を失敗させないためのフォールバック）。
 */
export async function compressImageFile(file: File, maxDimension = 1600, quality = 0.82): Promise<File> {
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    // 既に十分小さい画像を無理に再エンコードして画質を落とさないよう、
    // 縮小が不要（scale===1）かつ元がJPEGならそのまま使う。
    if (scale === 1 && file.type === "image/jpeg" && file.size <= 1.5 * 1024 * 1024) {
      bitmap.close?.();
      return file;
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // createImageBitmap/canvas がサポートされない・失敗した環境では、
    // 圧縮を諦めて元のファイルをそのまま送信する。
    return file;
  }
}
