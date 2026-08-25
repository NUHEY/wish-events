"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { ImageDropzone } from "@/components/ui/image-dropzone";
import { Button } from "@/components/ui/button";
import { removeProfileCover, uploadProfileCover } from "@/actions/avatar";

export function ProfileCoverUploader({ initialUrl }: { initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [pending, startTransition] = useTransition();
  function upload(file: File) {
    const preview = URL.createObjectURL(file); setUrl(preview);
    const formData = new FormData(); formData.set("cover", file);
    startTransition(async () => {
      const result = await uploadProfileCover(formData);
      if (result.error) { setUrl(initialUrl ?? ""); toast.error(result.error); }
      else if (result.url) { setUrl(result.url); toast.success("カバー画像を保存しました"); }
      URL.revokeObjectURL(preview);
    });
  }
  function remove() {
    startTransition(async () => {
      const result = await removeProfileCover();
      if (result.error) toast.error(result.error); else { setUrl(""); toast.success("カバー画像を削除しました"); }
    });
  }
  return <div className="grid gap-2"><ImageDropzone value={url} onFile={upload} disabled={pending} label="プロフィールのカバー画像（任意）" />{url && <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={pending} onClick={remove}><X className="h-3.5 w-3.5" />削除</Button>}<p className="text-xs text-muted-foreground">国際交流や寮生活が伝わる横長の写真がおすすめです。</p></div>;
}
