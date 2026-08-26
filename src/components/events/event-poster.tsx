import Image from "next/image";
import { cn } from "@/lib/utils";
import { DEFAULT_EVENT_IMAGE_URL } from "@/lib/media-defaults";

/**
 * イベントポスター画像の統一表示コンポーネント。
 *
 * ポスターはA4想定（縦長）で作られることが多いため、object-coverで
 * トリミングすると重要な部分が切れてしまう。そこで、
 *  1. 背景に同じ画像を拡大・ぼかして敷く（画像自体の色味に合わせた余白になる）
 *  2. 前面に同じ画像をobject-containで重ねる（必ず全体が見える）
 * という2枚重ねにすることで、どの画像でも統一感のある余白ができるようにしている。
 */
export function EventPoster({
  src,
  alt,
  emptyLabel,
  className,
  priority,
  ratioClassName = "aspect-[3/4]",
  roundedClassName = "rounded-lg",
}: {
  src: string | null;
  alt: string;
  emptyLabel: string;
  className?: string;
  priority?: boolean;
  /**
   * 縦横比を指定するTailwindユーティリティクラス（例: "aspect-[4/5]"）。
   * 一覧のカードのようにスマホでの縦スクロール量を抑えたい場所ではデフォルトの
   * 3/4より少し正方形に近い比率を渡す。動的なテンプレート文字列は
   * Tailwindの静的解析で拾われないため、必ずリテラルの完全なクラス名を渡すこと。
   */
  ratioClassName?: string;
  /** 一覧カードでは外側の直近要素だけでクリップするため rounded-none を渡す。 */
  roundedClassName?: string;
}) {
  // 画像未登録の場合はWaseda WISHをイメージしたデフォルト画像を表示する（「画像なし」の空白を避けるため）。
  const isDefault = !src;
  const displaySrc = src ?? DEFAULT_EVENT_IMAGE_URL;

  return (
    <div className={cn("relative isolate w-full overflow-hidden bg-muted [transform:translateZ(0)]", roundedClassName, ratioClassName, className)}>
      <Image
        src={displaySrc}
        alt=""
        fill
        aria-hidden
        className={cn("object-cover opacity-50 blur-2xl [transform:translateZ(0)_scale(1.1)] [will-change:transform]", isDefault && "opacity-70")}
        sizes="(max-width: 768px) 100vw, 33vw"
      />
      <Image
        src={displaySrc}
        alt={isDefault ? emptyLabel : alt}
        fill
        priority={priority}
        className={cn("relative drop-shadow-sm", isDefault ? "object-cover" : "object-contain")}
        sizes="(max-width: 768px) 100vw, 33vw"
      />
    </div>
  );
}
