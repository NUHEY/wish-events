"use client";

import { useAutoAnimate } from "@/components/layout/use-motion-auto-animate";

/**
 * 画面遷移時の追加・削除をWeb Animations APIで短く補間する。
 * Auto Animateはprefers-reduced-motionを尊重し、JS量も小さいため全画面で使える。
 */
export function AutoAnimatePage({ children }: { children: React.ReactNode }) {
  const [parent] = useAutoAnimate<HTMLDivElement>({ duration: 170, easing: "ease-out" });
  return <div ref={parent} className="min-w-0">{children}</div>;
}
