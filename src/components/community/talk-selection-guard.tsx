"use client";

import { useEffect } from "react";

/** Native selection is disabled across all talk screens; drafts remain editable. */
export function TalkSelectionGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    const editable = (target: EventTarget | Node | null) => {
      const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
      return !!element?.closest('input, textarea, [contenteditable="true"], [contenteditable="plaintext-only"]');
    };
    const clearSelection = () => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && !(editable(selection.anchorNode) && editable(selection.focusNode))) selection.removeAllRanges();
    };
    const preventNativeMenu = (event: Event) => { if (!editable(event.target)) event.preventDefault(); };
    const preventSelectAll = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !editable(event.target)) event.preventDefault();
    };
    root.dataset.talkSelectionLocked = "true";
    clearSelection();
    document.addEventListener("selectstart", preventNativeMenu, true);
    document.addEventListener("contextmenu", preventNativeMenu, true);
    document.addEventListener("dragstart", preventNativeMenu, true);
    document.addEventListener("selectionchange", clearSelection);
    document.addEventListener("keydown", preventSelectAll, true);
    return () => {
      delete root.dataset.talkSelectionLocked;
      document.removeEventListener("selectstart", preventNativeMenu, true);
      document.removeEventListener("contextmenu", preventNativeMenu, true);
      document.removeEventListener("dragstart", preventNativeMenu, true);
      document.removeEventListener("selectionchange", clearSelection);
      document.removeEventListener("keydown", preventSelectAll, true);
    };
  }, []);
  return <div data-talk-surface className="contents">{children}</div>;
}
