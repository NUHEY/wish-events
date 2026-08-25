"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { useDict } from "@/lib/i18n/locale-provider";
import { uploadLineQr } from "@/actions/line-qr";

/**
 * LINEのQRコード画像は非公開Storageバケットに保存されるため、表示には
 * サーバー側で発行した短命の署名付きURLが必要（`getLineQrSignedUrl`）。
 * このコンポーネントはページ(Server Component)から初期の署名付きURLを
 * 受け取り、アップロード/削除後は `router.refresh()` でページごと再取得する。
 */
export function LineQrUploader({
  hasQr,
  initialSignedUrl,
}: {
  hasQr: boolean;
  initialSignedUrl: string | null;
}) {
  const dict = useDict();
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(initialSignedUrl);
  const [uploaded, setUploaded] = React.useState(hasQr);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const localPreviewRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setPreviewUrl(initialSignedUrl);
    setUploaded(hasQr);
  }, [initialSignedUrl, hasQr]);

  React.useEffect(() => {
    return () => {
      if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    };
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    const localPreview = URL.createObjectURL(file);
    localPreviewRef.current = localPreview;
    setPreviewUrl(localPreview);

    const formData = new FormData();
    formData.set("line_qr", file);

    startTransition(async () => {
      const result = await uploadLineQr(formData);
      if (result?.error) {
        setError(result.error);
        setPreviewUrl(initialSignedUrl);
      } else {
        setUploaded(true);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-2">
      <PendingFeedback active={pending} label={dict.profile.lineUploading} />
      <p className="text-xs text-muted-foreground">{dict.profile.lineHint}</p>

      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="LINE QR" className="h-full w-full object-contain" />
          ) : (
            <QrCode className="h-8 w-8 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {uploaded ? dict.profile.lineUploaded : dict.profile.lineNotUploaded}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
            >
              {pending ? dict.profile.lineUploading : dict.profile.lineUploadButton}
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">{dict.profile.linePrivacyNote}</p>
    </div>
  );
}
