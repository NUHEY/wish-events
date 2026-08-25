"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";
import { AvatarStack } from "@/components/community/avatar-stack";
import { AvatarRing } from "@/components/profile/avatar-ring";

type Participant = { id: string; full_name: string | null; avatar_url: string | null; role: string };

/**
 * トーク画面ヘッダーのアバター重ね表示（AvatarStack）をタップすると、参加者の
 * 簡易リスト（名前+アイコン+RAバッジのみ）をその場で開けるようにする。
 * 以前はRA向けのCSV/集金管理も兼ねた重い参加者管理画面(/dashboard/[id]/participants)
 * しか参照先がなく、単に「誰がいるか」を見たいだけの場面には不釣り合いだったため、
 * トーク画面内で完結する軽量な一覧をここに新設した。
 */
export function TalkParticipantsButton({ participants, total }: { participants: Participant[]; total: number }) {
  const [open, setOpen] = useState(false);
  if (participants.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`参加者一覧（${total}人）`}
        className="rounded-full transition-transform active:scale-95"
      >
        <AvatarStack participants={participants} total={total} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 motion-safe:animate-fade-in sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[75vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-bold">参加者（{total}人）</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col divide-y divide-border overflow-y-auto px-4">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <AvatarRing role={p.role} size={36}>
                    {p.avatar_url ? (
                      <Image src={p.avatar_url} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                        {p.full_name?.charAt(0) ?? "?"}
                      </span>
                    )}
                  </AvatarRing>
                  <span className="text-sm font-medium">{p.full_name?.trim() || "名前未登録"}</span>
                  {p.role?.toLowerCase() === "ra" && (
                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                      RA
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
