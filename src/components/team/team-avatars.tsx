import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { UsersRound } from "lucide-react";
import type { TeamMemberRow } from "@/types/database";

export function TeamAvatars({ members, allRa }: { members: TeamMemberRow[]; allRa: boolean }) {
  if (!allRa && members.length === 0) return null;
  return (
    <div className="flex items-center" aria-label={allRa ? "RA全員が企画" : "企画メンバー"}>
      {allRa ? (
        <span title="RA全員" className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm">
          <UsersRound className="h-3.5 w-3.5" />
        </span>
      ) : (
        members.slice(0, 4).map((member, index) => (
          <span key={member.id} title={member.full_name ?? "名前未登録"} className="-ml-1 first:ml-0">
            <Image
              src={member.avatar_url || DEFAULT_AVATAR_IMAGE_URL}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-full border-2 border-card object-cover shadow-sm"
            />
          </span>
        ))
      )}
      {!allRa && members.length > 4 && <span className="-ml-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-semibold">+{members.length - 4}</span>}
    </div>
  );
}
