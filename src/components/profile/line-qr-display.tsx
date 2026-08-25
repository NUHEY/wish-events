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
      <div className="flex items-start gap-3">
        <div className="h-32 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          <Image
            src={src}
            alt="LINE QR"
            width={128}
            height={128}
            className="h-full w-full object-contain"
            unoptimized
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 pt-1">
          <p className="text-xs leading-relaxed text-muted-foreground">{dict.profile.lineDownloadHint}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleDownload}
            className="w-fit gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {pending ? dict.profile.lineDownloading : dict.profile.lineDownloadButton}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
