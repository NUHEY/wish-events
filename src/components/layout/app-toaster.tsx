"use client";

import { Toaster } from "sonner";

/**
 * サイト全体で使う保存/更新完了などのトースト通知。
 * モバイルでは下部にタブバーが固定表示されているため、それと被らないよう
 * 上部中央に表示する。見た目はカード系コンポーネント（rounded-2xl, shadow-card）
 * に合わせている。
 */
export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl border border-border bg-card text-foreground shadow-card-hover px-4 py-3",
          title: "text-sm font-medium",
          description: "text-xs text-muted-foreground",
          success: "!border-primary/30",
          error: "!border-destructive/40",
        },
      }}
    />
  );
}
