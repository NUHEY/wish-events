"use client";

import { useState, useTransition } from "react";
import { Beaker, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateFeatureFlag } from "@/actions/feature-flags";
import { PendingFeedback } from "@/components/ui/pending-feedback";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const featureCopy: Record<FeatureFlagKey, { title: string; description: string }> = {
  friend_dm: { title: "友達とのトーク", description: "通信量と無料枠を見ながら段階的に公開できます。" },
  floor_group_chat: { title: "フロアグループ", description: "同じ階の寮生とRAが自動参加するグループトークです。" },
  event_calendar_export: { title: "イベントをカレンダーに追加", description: "端末の標準カレンダーへイベント日時を保存できます。" },
  availability_matching: { title: "みんなの日程調整", description: "任意の2人以上で空き時間を重ねて確認できます。" },
  lets_chat_booking: { title: "Let's Chat! 予約", description: "同じフロアの寮生がRAの空き時間を予約できます。" },
  unit_room_sessions: { title: "URS 日程調整", description: "ルームメイトとRAが全員集まれる時間を探せます。" },
  ra_question_box: { title: "RAへの質問箱", description: "質問への回答と、全寮生向けQ&Aの公開ができます。" },
  ra_link_hub: { title: "RAリンクページ", description: "外泊届やSNSなど、よく使うリンクをまとめて公開できます。" },
  wish_knowledge: { title: "WISH知恵袋", description: "寮生同士で質問し、経験や知識を回答として共有できます。" },
  resident_events: { title: "寮生イベント募集", description: "ご飯や外出などの小さな集まりを寮生自身が募集できます。" },
};

export function FeatureFlagManager({ featureKey, initialState }: { featureKey: FeatureFlagKey; initialState: FeatureFlagState }) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const copy = featureCopy[featureKey];
  const states: { value: FeatureFlagState; label: string; note: string; icon: typeof Eye }[] = [
    { value: "public", label: "公開する", note: "全寮生に通常機能として公開します", icon: Eye },
    { value: "beta", label: "ベータ版で公開", note: "BETA表記付きで全寮生に公開します", icon: Beaker },
    { value: "hidden", label: "公開しない", note: "画面から非表示にします（初期値）", icon: EyeOff },
  ];

  function change(next: FeatureFlagState) {
    if (pending || next === state) return;
    const previous = state;
    setState(next);
    startTransition(async () => {
      const result = await updateFeatureFlag(featureKey, next);
      if (result.error) {
        setState(previous);
        toast.error(result.error);
      } else {
        toast.success("公開設定を更新しました");
      }
    });
  }

  return <><PendingFeedback active={pending} label="公開設定を更新しています…" /><section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-start gap-3 border-b border-border bg-secondary/30 p-5"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><div><h2 className="font-bold">{copy.title}</h2><p className="mt-1 text-sm text-muted-foreground">{copy.description} 初期値は「公開しない」です。</p></div></div><div className="grid gap-2 p-4 sm:grid-cols-3">{states.map((option) => { const active = state === option.value; return <button key={option.value} type="button" disabled={pending} onClick={() => change(option.value)} className={cn("flex min-h-32 flex-col items-start rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] active:scale-[0.98] disabled:cursor-wait", active ? "border-primary/40 bg-primary/[0.07] shadow-sm" : "border-border sm:hover:border-primary/20 sm:hover:bg-secondary/35")}><span className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}><option.icon className="h-4 w-4" /></span><span className="text-sm font-semibold">{option.label}</span><span className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.note}</span></button>; })}</div></section></>;
}
