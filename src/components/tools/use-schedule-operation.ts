"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

/** React 18 transitions do not track awaited requests; lock synchronously until they settle. */
export function useScheduleOperation() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);

  async function run(operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await operation();
    } catch {
      toast.error("処理を確認できませんでした。画面を再読み込みして結果を確認してください。");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { pending, run };
}
