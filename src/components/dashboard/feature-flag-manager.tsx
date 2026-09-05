"use client";

import { useRef, useState } from "react";
import { Beaker, Check, Eye, EyeOff } from "lucide-react";
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
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const copy = featureCopy[featureKey];
  const states: { value: FeatureFlagState; label: string; note: string; icon: typeof Eye }[] = [
    { value: "public", label: "公開する", note: "全寮生に通常機能として公開します", icon: Eye },
    { value: "beta", label: "ベータ版で公開", note: "BETA表記付きで全寮生に公開します", icon: Beaker },
    { value: "hidden", label: "公開しない", note: "寮生の画面から非表示にします", icon: EyeOff },
  ];

  async function change(next: FeatureFlagState) {
    if (saving.current || next === state) return;
    saving.current = true;
    setPending(true);
    try {
      const result = await updateFeatureFlag(featureKey, next);
      if (result.error) {
        toast.error(result.error);
      } else {
        setState(next);
        toast.success("公開設定を更新しました");
      }
    } catch {
      toast.error("保存できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${featureKey}-title`} aria-busy={pending} className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <PendingFeedback active={pending} label="公開設定を更新しています…" />
      <h3 id={`${featureKey}-title`} className="break-words font-bold leading-snug">{copy.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy.description}</p>
      <div role="group" aria-labelledby={`${featureKey}-title`} className="mt-3 grid gap-2 sm:grid-cols-3">
        {states.map((option) => {
          const active = state === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={pending}
              onClick={() => change(option.value)}
              className={cn(
                "flex min-h-11 min-w-0 items-start gap-2.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60",
                active ? "border-primary/50 bg-primary/[0.07]" : "border-border hover:bg-secondary/35"
              )}
            >
              <option.icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{option.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.note}</span>
              </span>
              {active && <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}
