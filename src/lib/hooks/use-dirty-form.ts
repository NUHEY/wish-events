"use client";

import { useCallback, useRef, useState } from "react";

/**
 * <form>要素に付けるだけで「未保存の変更があるか」を検知できる汎用フック。
 * フォーム内のどの input/select/textarea が変化しても（バブリングする
 * change/input イベントで検知するため）isDirty が true になる。
 * サーバーアクション成功後にリダイレクトされるフォームでは特に何もしなくてよいが、
 * 同一ページに留まって成功する場合は reset() を呼んで false に戻すこと。
 */
export function useDirtyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isDirty, setIsDirty] = useState(false);

  const markDirty = useCallback(() => setIsDirty(true), []);
  const reset = useCallback(() => setIsDirty(false), []);

  return { formRef, isDirty, markDirty, reset };
}
