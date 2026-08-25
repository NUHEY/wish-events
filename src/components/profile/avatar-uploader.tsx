"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { User, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import { useDict } from "@/lib/i18n/locale-provider";
import { uploadAvatar, removeAvatar } from "@/actions/avatar";

export function AvatarUploader({ initialUrl }: { initialUrl: string | null }) {
  const dict = useDict();
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(initialUrl);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const localPreviewRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    setPreviewUrl(initialUrl);
  }, [initialUrl]);

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
    formData.set("avatar", file);

    startTransition(async () => {
      const result = await uploadAvatar(formData);
      if (result?.error) {
        setError(result.error);
        setPreviewUrl(initialUrl);
      } else {
        toast.success(dict.toast.saved);
        router.refresh();
      }
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (result?.error) {
        setError(result.error);
      } else {
        setPreviewUrl(null);
        toast.success(dict.toast.removed);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <PendingFeedback active={pending} label={dict.profile.avatarUploading} />
      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary shadow-sm">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium">{dict.profile.avatarLabel}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" />
            {pending ? dict.profile.avatarUploading : dict.profile.avatarUploadButton}
          </Button>
          {previewUrl && (
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleRemove}>
              <X className="h-3.5 w-3.5" />
              {dict.profile.avatarRemoveButton}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
