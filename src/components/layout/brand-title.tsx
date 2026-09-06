import type { CSSProperties } from "react";

export type BrandAnimation = "shine" | "underline" | "lift";

/** CSS-only motion keeps the title readable and reserves exactly the same layout space. */
export function BrandTitle({ animation = "none", intervalSeconds = 45, preview = false }: { animation?: BrandAnimation | "none"; intervalSeconds?: number; preview?: boolean }) {
  return <span className="wish-brand-title text-lg font-bold tracking-tight" data-brand-animation={animation} style={{ "--brand-delay": preview ? "0s" : "8s", "--brand-interval": `${Math.min(120, Math.max(20, intervalSeconds))}s` } as CSSProperties}>WISH Events</span>;
}
