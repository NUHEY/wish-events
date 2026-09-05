"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { Users, X } from "lucide-react";
import { AvatarStack } from "@/components/community/avatar-stack";
import { AvatarRing } from "@/components/profile/avatar-ring";
import { DEFAULT_AVATAR_IMAGE_URL } from "@/lib/media-defaults";
import { useDict, useLocale } from "@/lib/i18n/locale-provider";

type Participant = { id: string; full_name: string | null; avatar_url: string | null; role: string };

/** Keep the modal outside the blurred chat header's fixed-position containing block. */
export function TalkParticipantsButton({ participants, total }: { participants: Participant[]; total: number }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const locale = useLocale();
  const dict = useDict();
  const title = locale === "ja" ? `参加者（${total}人）` : `Participants (${total})`;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-label={title} aria-haspopup="dialog" aria-expanded={open}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex items-center gap-1.5 sm:hidden"><Users className="h-5 w-5" /><span>{total}</span></span>
        <span className="hidden sm:block"><AvatarStack participants={participants} total={total} /></span>
      </button>
      {open && createPortal(
        <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={() => setOpen(false)}
          className="m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-black/40">
          <div className="flex min-h-full items-end justify-center sm:items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
            <section className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-2xl sm:rounded-2xl sm:pb-0">
              <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
                <h2 id={titleId} className="font-bold">{title}</h2>
                <button type="button" autoFocus onClick={() => setOpen(false)} aria-label={dict.common.close}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-5 w-5" /></button>
              </header>
              <ul className="min-h-0 divide-y divide-border overflow-y-auto overscroll-contain px-4">
                {participants.map((person) => (
                  <li key={person.id} className="flex items-center gap-3 py-3">
                    <AvatarRing role={person.role} size={36}><Image src={person.avatar_url || DEFAULT_AVATAR_IMAGE_URL} alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" /></AvatarRing>
                    <span className="min-w-0 flex-1 break-words text-sm font-medium">{person.full_name?.trim() || dict.talks.residentFallback}</span>
                    {person.role === "ra" && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">RA</span>}
                  </li>
                ))}
              </ul>
              {participants.length === 0 && <p className="p-5 text-sm text-muted-foreground">{locale === "ja" ? "参加者はまだいません。" : "There are no participants yet."}</p>}
            </section>
          </div>
        </dialog>, document.body
      )}
    </>
  );
}
