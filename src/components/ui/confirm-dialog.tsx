"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 削除等の破壊的操作なら赤系ボタンにする。 */
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * サイト全体で使う確認ダイアログ。
 * window.confirm()はブラウザ/OS標準のポップアップになってしまい見た目を
 * 統一できないため、代わりにこのコンポーネントが提供する useConfirm() を使う。
 * root layoutで一度だけ<ConfirmDialogProvider>を被せておけば、
 * 以降はどのクライアントコンポーネントからも
 *   const confirm = useConfirm();
 *   if (!(await confirm({ message: "削除しますか？" }))) return;
 * という形でwindow.confirm()と同じ感覚のまま呼び出せる。
 */
export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  const locale = useLocale();

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function close(result: boolean) {
    dialogRef.current?.close();
    pending?.resolve(result);
    setPending(null);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!pending || !dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // The browser's modal top layer contains focus and makes the page inert.
    // close() also restores focus to the control that opened the confirmation.
    dialog.showModal();
    cancelButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <dialog
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={pending.title ? titleId : messageId}
            aria-describedby={pending.title ? messageId : undefined}
            onCancel={(e) => {
              e.preventDefault();
              close(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Tab") return;
              const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
              const first = buttons[0];
              const last = buttons[buttons.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
              }
            }}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const bounds = e.currentTarget.getBoundingClientRect();
              if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) close(false);
            }}
            className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-elevated backdrop:bg-black/50 motion-safe:animate-pop-in"
          >
            <div className="flex items-start gap-3">
              {pending.danger && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                {pending.title && <p id={titleId} className="font-semibold">{pending.title}</p>}
                <p id={messageId} className={cn("whitespace-pre-wrap text-sm text-foreground/90", !pending.title && "font-medium")}>
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button ref={cancelButtonRef} type="button" variant="outline" size="sm" onClick={() => close(false)}>
                {pending.cancelLabel ?? (locale === "ja" ? "キャンセル" : "Cancel")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={pending.danger ? "destructive" : "default"}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? "OK"}
              </Button>
            </div>
        </dialog>
      )}
    </ConfirmContext.Provider>
  );
}

/** window.confirm()の代わりに使う。Promise<boolean>でユーザーの選択を返す。 */
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm() must be used within <ConfirmDialogProvider>");
  }
  return confirm;
}
