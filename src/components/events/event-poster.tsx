import Image from "next/image";
import { cn } from "@/lib/utils";

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
}) {
  return (
    <div className={cn("relative w-full overflow-hidden bg-muted", ratioClassName, className)}>
      {src ? (
        <>
          <Image
            src={src}
            alt=""
            fill
            aria-hidden
            className="scale-110 object-cover opacity-50 blur-2xl"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            className="relative object-contain drop-shadow-sm"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
