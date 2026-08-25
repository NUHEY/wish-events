import { AVATAR_RING_GOLD_HEX, AVATAR_RING_GOLD_THRESHOLD, AVATAR_RING_RA_HEX } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * アイコン周りの装飾リング（ゲーム要素）。
 * RAは常にワインレッド、一般寮生はイベント参加数が一定数を超えると金色になる。
 * どちらでもなければ通常表示のまま何も変えない。
 */
export function AvatarRing({
  role,
  eventCount,
  children,
  className,
}: {
  role?: string | null;
  eventCount?: number | null;
  children: React.ReactNode;
  className?: string;
}) {
  const isRa = role === "ra";
  const isGold = !isRa && (eventCount ?? 0) >= AVATAR_RING_GOLD_THRESHOLD;

  if (!isRa && !isGold) return <>{children}</>;

  return (
    <span
      className={cn("inline-flex shrink-0 rounded-full p-[2.5px]", className)}
      style={{
        background: isRa
          ? AVATAR_RING_RA_HEX
          : `linear-gradient(135deg, ${AVATAR_RING_GOLD_HEX}, #F5E1A4, ${AVATAR_RING_GOLD_HEX})`,
      }}
    >
      <span className="block rounded-full bg-card p-[1.5px]">{children}</span>
    </span>
  );
}
