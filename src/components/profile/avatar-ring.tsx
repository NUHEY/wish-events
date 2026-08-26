import { AVATAR_RING_GOLD_HEX, AVATAR_RING_GOLD_THRESHOLD } from "@/lib/constants";
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
 * 【写真が円にならない問題への対応】
 * 以前は中身（children）の実サイズに依存していたため、正方形以外の画像や
 * 想定より小さい/大きい写真を渡すと、リングだけが円でも肝心の写真自体が
 * 円に切り抜かれず角が見えてしまうことがあった（RAのコメント欄アイコン等で発生）。
 * どんな写真サイズでも必ず円になるよう、以下の対策を組み合わせている。
 *  1. 外側・内側それぞれのラッパーに明示的な width/height（=size, px）を指定し、
 *     boxSizing: border-box で padding込みのサイズを固定する。
 *  2. すべての階層に overflow-hidden + rounded-full を重ねがけする。
 *  3. children（写真 or イニシャル文字のフォールバック）がどんな幅・高さで
 *     渡されても、`[&>*]:!h-full [&>*]:!w-full [&>*]:!object-cover` で
 *     強制的に親いっぱいに引き伸ばし・トリミングする。
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
            ? "hsl(var(--primary))"
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
