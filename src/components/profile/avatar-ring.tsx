import { AVATAR_RING_GOLD_HEX, AVATAR_RING_GOLD_THRESHOLD, AVATAR_RING_RA_HEX } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * アイコン周りの装飾リング（ゲーム要素）。
 * RAは常にワインレッド、一般寮生はイベント参加数が一定数を超えると金色になる。
 * どちらでもなければ通常表示のまま何も変えない。
 *
 * リングの太さはアイコンの表示サイズ(size, px)に比例させる。固定pxのままだと
 * トークの28pxアイコンなどではリングが太すぎて見えてしまうため。
 * sizeを省略した場合はマイページ等で使われてきた64px相当（=既存の見た目）を維持する。
 */
export function AvatarRing({
  role,
  eventCount,
  size = 64,
  children,
  className,
}: {
  role?: string | null;
  eventCount?: number | null;
  /** アイコンの表示サイズ(px)。リングの太さをこれに比例させる。省略時は64px相当。 */
  size?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const isRa = role?.toLowerCase() === "ra";
  const isGold = !isRa && (eventCount ?? 0) >= AVATAR_RING_GOLD_THRESHOLD;

  if (!isRa && !isGold) return <>{children}</>;

  const outerPad = Math.max(1.25, Math.min(3.5, size * 0.055));
  const innerGap = Math.max(0.75, Math.min(2.5, size * 0.04));

  return (
    <span
      className={cn("inline-flex shrink-0 rounded-full", className)}
      style={{
        padding: outerPad,
        background: isRa
          ? AVATAR_RING_RA_HEX
          : `linear-gradient(135deg, ${AVATAR_RING_GOLD_HEX}, #F5E1A4, ${AVATAR_RING_GOLD_HEX})`,
      }}
    >
      <span className="block rounded-full bg-card" style={{ padding: innerGap }}>
        {children}
      </span>
    </span>
  );
}
