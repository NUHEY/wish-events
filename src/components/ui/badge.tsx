import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// h-5 + leading-none で高さをピクセル固定にしている。日本語(CJK)と英数字は
// フォントの内部メトリクスが異なり、同じ line-height でも字体次第で見かけの
// 高さが揃わないことがあるため（例: 「RR」と「新規」を並べた時に高さがずれる
// バグ）、行の高さに依存せず箱の高さそのものを固定して常に揃うようにする。
const badgeVariants = cva(
  "inline-flex h-5 items-center rounded-full border px-2.5 text-xs font-semibold leading-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
