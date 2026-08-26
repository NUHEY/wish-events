"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/locale-provider";

/** イベント共有と同様に、端末の共有シートを優先し、非対応環境ではURLをコピーする。 */
export function ProfileShareButton({
  profileId,
  fullName,
  className,
}: {
  profileId: string;
  fullName: string | null;
  className?: string;
}) {
  const dict = useDict();
  const [copied, setCopied] = useState(false);

  async function shareProfile() {
    const url = `${window.location.origin}/directory/${profileId}`;
    const title = fullName?.trim() || "WISH Eventsプロフィール";
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title}のプロフィール`, url });
      } catch {
        // 共有シートを閉じただけの場合はエラー表示を出さない。
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast.success("プロフィールURLをコピーしました");
    } catch {
      toast.error("プロフィールを共有できませんでした");
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={shareProfile}>
      <Share2 className="h-3.5 w-3.5" />
      {copied ? "コピーしました" : dict.directory.shareProfileButton}
    </Button>
  );
}
