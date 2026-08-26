"use client";

import { useState } from "react";
import Image from "next/image";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { UsersRound } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { TeamMemberRow } from "@/types/database";

export function TeamPicker({
  members,
  initialMemberIds = [],
  initialAllRa = false,
}: {
  members: TeamMemberRow[];
  initialMemberIds?: string[];
  initialAllRa?: boolean;
}) {
  const [allRa, setAllRa] = useState(initialAllRa);

  return (
    <fieldset className="grid gap-3 rounded-xl border border-border bg-secondary/20 p-3.5">
      <legend className="px-1 text-sm font-semibold">企画メンバー / Organizing team</legend>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-background px-3 py-2.5 text-sm font-medium">
        <Checkbox
          name="all_ra_members"
          checked={allRa}
          onCheckedChange={(checked) => setAllRa(checked === true)}
        />
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UsersRound className="h-4 w-4" />
        </span>
        RA全員 / All RAs
      </label>
      {!allRa && (
        <div className="grid gap-1 sm:grid-cols-2">
          {members.map((member) => (
            <label key={member.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background">
              <Checkbox name="member_ids" value={member.id} defaultChecked={initialMemberIds.includes(member.id)} />
              <Image src={member.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
              <span>{member.full_name ?? "名前未登録"}</span>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">表示したい企画メンバーを選択してください。</p>
    </fieldset>
  );
}
