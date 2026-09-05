import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * ネイティブ<select>ベースのコンポーネント。
 * このアプリのフォームはServer Actions + FormDataに依存しているため、
 * `name`属性がそのままフォーム送信に使われる必要がある。
 * Radix Selectはネイティブの<select>を描画しないため、`name`ベースの
 * 送信に対応するには全フォームでhidden inputへの置き換えが必要になり、
 * 本番運用中のフォームを壊すリスクが大きい。そのため見た目はshadcn/ui相当に
 * 整えつつ、内部はネイティブ<select>のまま保っている。
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-9 text-[16px] shadow-sm ring-offset-background transition-colors hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
);
Select.displayName = "Select";

export { Select };
