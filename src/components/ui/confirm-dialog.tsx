"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function close(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  useEffect(() => {
    if (!pending) return;
    cancelButtonRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 motion-safe:animate-fade-in"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.title ?? pending.message}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elevated motion-safe:animate-pop-in"
          >
            <div className="flex items-start gap-3">
              {pending.danger && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                {pending.title && <p className="font-semibold">{pending.title}</p>}
                <p className={cn("whitespace-pre-wrap text-sm text-foreground/90", !pending.title && "font-medium")}>
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button ref={cancelButtonRef} type="button" variant="outline" size="sm" onClick={() => close(false)}>
                {pending.cancelLabel ?? "キャンセル"}
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
          </div>
        </div>
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
