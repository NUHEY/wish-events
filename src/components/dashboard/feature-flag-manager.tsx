"use client";

import { useState, useTransition } from "react";
import { Beaker, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateFeatureFlag } from "@/actions/feature-flags";
import type { FeatureFlagState } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const states: { value: FeatureFlagState; label: string; note: string; icon: typeof Eye }[] = [
  { value: "public", label: "公開する", note: "全寮生が友達DMを利用できます", icon: Eye },
  { value: "beta", label: "ベータ版で公開", note: "BETA表記付きで全寮生に公開します", icon: Beaker },
  { value: "hidden", label: "公開しない", note: "友達DMを画面とURLの両方で非公開にします", icon: EyeOff },
];

export function FeatureFlagManager({ initialState }: { initialState: FeatureFlagState }) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  function change(next: FeatureFlagState) {
    if (pending || next === state) return;
    const previous = state;
    setState(next);
    startTransition(async () => {
      const result = await updateFeatureFlag("friend_dm", next);
      if (result.error) { setState(previous); toast.error(result.error); }
      else toast.success("公開設定を更新しました");
    });
  }
  return <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-start gap-3 border-b border-border bg-secondary/30 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold">友達とのトーク</h2><p className="mt-1 text-sm text-muted-foreground">通信量と無料枠を見ながら段階的に公開できます。初期値は「公開しない」です。</p></div></div><div className="grid gap-2 p-4 sm:grid-cols-3">{states.map((option) => { const active = state === option.value; return <button key={option.value} type="button" disabled={pending} onClick={() => change(option.value)} className={cn("flex min-h-32 flex-col items-start rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] active:scale-[0.98] disabled:cursor-wait", active ? "border-primary/40 bg-primary/[0.07] shadow-sm" : "border-border hover:border-primary/20 hover:bg-secondary/35")}><span className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}><option.icon className="h-4 w-4" /></span><span className="text-sm font-semibold">{option.label}</span><span className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.note}</span></button>; })}</div></section>;
}
