"use client";

import { useEffect, useRef } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * 保存されていない入力内容がある状態での画面遷移を防ぐための共通フック。
 * isDirty を渡すだけで、以下2パターンをまとめてガードする。
 *
 * 1. タブを閉じる・リロードする・外部サイトへ移動する場合:
 *    ブラウザ標準の beforeunload 確認ダイアログを出す
 *    （セキュリティ上の制約でここだけは独自UIに置き換えられない）。
 * 2. サイト内リンクのクリックによる画面遷移:
 *    サイト共通の ConfirmDialogProvider による確認ポップアップを表示し、
 *    キャンセルした場合はそのページに留まる。
 *
 * フォームが保存・送信済みになったタイミングで isDirty を false に戻すこと。
 */
export function useUnsavedChangesGuard(isDirty: boolean, message: string) {
  const confirm = useConfirm();
  const isDirtyRef = useRef(isDirty);
  const confirmingRef = useRef(false);
  isDirtyRef.current = isDirty;

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!isDirtyRef.current || confirmingRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      confirmingRef.current = true;
      confirm({ message, danger: true }).then((ok) => {
        confirmingRef.current = false;
        if (ok) {
          isDirtyRef.current = false;
          window.location.href = href;
        }
      });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirm, message]);
}
