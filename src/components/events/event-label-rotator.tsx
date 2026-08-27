import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type EventCardLabel = {
  text: string;
  tone: "category" | "deadline" | "new";
};

export const DEFAULT_EVENT_LABEL_ROTATION_MS = 3600;

/** 同じイベントは再描画後も同じ並び・位相になる、軽量な決定的ハッシュ。 */
function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const result = [...items];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

type LabelStyle = CSSProperties & Record<`--event-label-${string}`, string | number>;

/**
 * 複数ラベルを1件ずつ循環表示する。イベントIDから並び・速度・開始位置を
 * 決めるため、全カードが一斉に切り替わらず、再読み込みのたびに不自然に
 * 飛びもしない。ReactのsetIntervalをカードごとに作らずCSSで送るので、
 * ラベル数が増えてもタイマーや再描画の数は増えない。
 */
export function EventLabelRotator({
  labels,
  seed,
  enabled = true,
  intervalMs = DEFAULT_EVENT_LABEL_ROTATION_MS,
  jitterPercent = 18,
  shuffle = true,
  limit = 0,
  position = "top-left",
}: {
  labels: EventCardLabel[];
  seed: string;
  enabled?: boolean;
  intervalMs?: number;
  jitterPercent?: number;
  shuffle?: boolean;
  /** 0は無制限。将来ラベル種別が増えても表示処理自体は同じ。 */
  limit?: number;
  position?: "top-left" | "top-right";
}) {
  if (labels.length === 0) return null;

  const hash = stableHash(seed);
  const ordered = shuffle && labels.length > 1 ? shuffleWithSeed(labels, hash) : labels;
  const visibleLabels = limit > 0 ? ordered.slice(0, Math.max(1, limit)) : ordered;
  const baseMs = Math.min(12000, Math.max(1800, intervalMs));
  const jitter = Math.min(45, Math.max(0, jitterPercent)) / 100;
  // -1〜+1の揺らぎ。カードごとに周期もずれるので、しばらく表示しても同期しない。
  const variance = ((hash % 2001) / 1000 - 1) * jitter;
  const slotMs = Math.round(baseMs * (1 + variance));
  const count = visibleLabels.length;
  const cycleMs = slotMs * count;
  const phaseMs = count > 1 ? hash % cycleMs : 0;
  const shouldRotate = enabled && count > 1;
  const style: LabelStyle = {
    "--event-label-count": count,
    "--event-label-travel": `${-count * 1.25}rem`,
    "--event-label-slot": `${slotMs}ms`,
    "--event-label-cycle": `${cycleMs}ms`,
    "--event-label-delay": `${-phaseMs}ms`,
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute top-2 flex min-w-0 max-w-[calc(100%_-_1rem)] justify-start",
        position === "top-right" ? "right-2" : "left-2"
      )}
      style={style}
    >
      <div className={cn("event-label-window h-5 w-fit max-w-full min-w-0 overflow-hidden", shouldRotate && "event-label-window--rotating")}>
        <div
          className={cn(
            "event-label-track flex w-max max-w-full min-w-0 flex-col",
            position === "top-right" ? "items-end" : "items-start",
            shouldRotate && "event-label-track--rotating"
          )}
        >
          {visibleLabels.map((label, index) => (
            <Badge
              key={`${label.tone}-${label.text}-${index}`}
              variant={label.tone === "deadline" ? "destructive" : "secondary"}
              title={label.text}
              className={cn(
                "w-fit max-w-full min-w-0 shrink-0 overflow-hidden border-0 shadow-sm",
                label.tone === "category" && "bg-card text-card-foreground",
                label.tone === "new" && "bg-info text-info-foreground"
              )}
            >
              <span className="block min-w-0 truncate">{label.text}</span>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
