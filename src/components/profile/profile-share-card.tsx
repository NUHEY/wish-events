"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDict } from "@/lib/i18n/locale-provider";
import type { ProfileShareData } from "@/components/profile/profile-share-modal";

export type { ProfileShareData };

/**
 * Canvas描画を伴う共有モーダル本体（profile-share-modal.tsx）は、実際に
 * ボタンが押されるまで誰も使わない機能なので next/dynamic で遅延読み込みする。
 * これにより、マイページ・ディレクトリ詳細ページの初期表示ではこのモーダルの
 * JSを読み込まずに済み、画面遷移が速くなる。
 */
const ProfileShareModal = dynamic(
  () => import("@/components/profile/profile-share-modal").then((mod) => mod.ProfileShareModal),
  { ssr: false }
);

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
