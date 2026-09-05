import { Beaker } from "lucide-react";

export function BetaBadge() {
  return <span className="inline-flex shrink-0 items-center whitespace-nowrap gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold tracking-wide text-primary"><Beaker className="h-3 w-3" />BETA</span>;
}
