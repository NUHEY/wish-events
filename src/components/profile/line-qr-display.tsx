"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/locale-provider";
import { fetchAndDownloadImage } from "@/lib/canvas-share";

/** QR画像と保存操作は、必要なときに1行の見出しから開く。 */
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
    <details className="group min-w-0 rounded-xl border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <QrCode aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-line" />
        <span className="min-w-0 flex-1">{dict.profile.lineLabel}</span>
        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-md border border-border bg-white">
            <Image
              src={src}
              alt="LINE QR"
              width={128}
              height={128}
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
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </div>
    </details>
  );
}
