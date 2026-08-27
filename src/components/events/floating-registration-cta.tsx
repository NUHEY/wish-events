"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * イベント詳細ページの申込ボタン用フローティングCTA。
 *
 * 本来の申込ボタン（anchorIdの要素）がまだ画面外（下の方）にある間だけ、画面
 * 下部に固定でこのショートカットを表示する。本来のボタンが画面内に入ったら
 * （＝スクロールでそこに「到達」したら）自動的に消え、本来のボタンだけが機能する
 * 状態に戻る。逆に、一度通り過ぎたあとに上へスクロールして再び本来のボタンが
 * 画面外（下）になった場合は、このショートカットが再度表示される。
 * ただし、本来のボタンを一度下に通り過ぎた状態（スクロールでボタンより下まで
 * 進んだ状態）ではこのショートカットは表示しない。
 *
 * 本来のボタンは登録済み/満席/受付前/質問フォーム展開中など状態が多く、それを
 * 二重管理して不整合を起こすリスクを避けるため、タップ時は実際の登録処理を
 * 行わず、本来のボタンまでスムーズにスクロールするだけにとどめている。
 */
export function FloatingRegistrationCta({
  anchorId,
  label,
  disabled = false,
}: {
  anchorId: string;
  label: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(anchorId);
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // 本来の位置に見えている = そこに「固定」された状態なので何もしない。
          setVisible(false);
          return;
        }
        // まだ下にあって未到達の場合だけ表示する。上を通り過ぎて隠れた場合
        // （boundingClientRect.top <= 0）は何も表示しない。
        setVisible(entry.boundingClientRect.top > 0);
      },
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [anchorId]);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-30 isolate bg-gradient-to-t from-background via-background/95 to-transparent px-4 pb-[calc(var(--mobile-tab-bar-height)+env(safe-area-inset-bottom,0px)+0.75rem)] pt-10 backdrop-blur-md [transform:translateZ(0)] transition-[opacity,transform] duration-200 ease-out sm:pb-4 sm:pt-8 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <div className="pointer-events-auto mx-auto max-w-2xl">
        <Button
          type="button"
          disabled={disabled}
          tabIndex={visible ? 0 : -1}
          className="h-12 w-full rounded-xl shadow-elevated"
          onClick={() => {
            document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}
