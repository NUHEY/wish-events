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
 *
 * 【正円保証について】
 * 以前は外側/内側のラッパーが inline-flex + padding だけでサイズを決めており、
 * 最終的な見た目のサイズを渡された中身(children)の実際の width/height に
 * 完全に依存していた。そのため、画像の実アスペクト比とCSSクラス指定がずれて
 * いたり、呼び出し側でh-N/w-Nの指定が漏れていたりすると、正円にならず楕円に
 * なってしまう〓#��があった（RAリング付きアバターで特に目立っていた）。
 * ここでは outer→inner→photo の3層すべてで width/height を size(px) から
 * 明示的に固定し、box-sizing: border-box でパディングがサイズをはみ出さない
 * ようにした上で、最内層に overflow-hidden + rounded-full を必ず適用し、
 * 中身（<img>でもフォールバックの<span>でも）を h-full/w-full/object-cover で
 * 強制的に埋める。これにより、呼び出し側が何を渡してもサイズがどうであっても、
 * 常に正円で表示されることを1箇所で保証する。
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
  /** アイコンの表示サイズ(px)。リングの太さ・全体サイズをこれに比例させる。省略時は64px相当。 */
  size?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const isRa = role === "ra";
  const isGold = !isRa && (eventCount ?? 0) >= AVATAR_RING_GOLD_THRESHOLD;
  const hasRing = isRa || isGold;

  const outerPad = hasRing ? Math.max(1.25, Math.min(3.5, size * 0.055)) : 0;
  const innerGap = hasRing ? Math.max(0.75, Math.min(2.5, size * 0.04)) : 0;

  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        boxSizing: "border-box",
        padding: outerPad,
        background: hasRing
          ? isRa
            ? AVATAR_RING_RA_HEX
            : `linear-gradient(135deg, ${AVATAR_RING_GOLD_HEX}, #F5E1A4, ${AVATAR_RING_GOLD_HEX})`
          : undefined,
      }}
    >
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          hasRing && "bg-card"
        )}
        style={{ boxSizing: "border-box", padding: innerGap }}
      >
        <span className="block h-full w-full overflow-hidden rounded-full [&>*]:!h-full [&>*]:!w-full [&>*]:!max-w-none [&>*]:!object-cover">
          {children}
        </span>
      </span>
    </span>
  );
}
