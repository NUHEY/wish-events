"use client";

import { useState } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/locale-provider";
import { fetchAndDownloadImage } from "@/lib/canvas-share";

/**
 * 他の寮生のマイページに表示するLINEのQRコード。
 * スクリーンショットに頼らず、元画像をそのまま保存できるダウンロードボタンを
 * 常に併記し、保存方法が一目でわかるようにする。
 */
export function LineQrDisplay({ src, name }: { src: string; name?: string | null }) {
  const dict = useDict();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setError(null);
    setPending(true);
    try {
      const safeName = (name ?? "wish").trim().replace(/[^\w\-ぁ-んァ-ヶー一-龠]+/g, "_") || "wish";
      await fetchAndDownloadImage(src, `line-qr-${safeName}.png`);
    } catch {
      setError(dict.profile.lineDownloadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          <Image
            src={src}
            alt="LINE QR"
            width={80}
            height={80}
            className="h-full w-full object-contain"
            unoptimized
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={pending}
          onClick={handleDownload}
          aria-label={pending ? dict.profile.lineDownloading : dict.profile.lineDownloadButton}
          title={pending ? dict.profile.lineDownloading : dict.profile.lineDownloadButton}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
