"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateFeatureFlag } from "@/actions/feature-flags";
import { Select } from "@/components/ui/select";
import type { FeatureFlagKey, FeatureFlagState } from "@/lib/feature-flags";

const featureCopy: Record<FeatureFlagKey, { title: string; description: string }> = {
  friend_dm: { title: "友達とのトーク", description: "友達同士でメッセージをやり取り。" },
  floor_group_chat: { title: "フロアグループ", description: "同じ階の寮生とRAが自動参加するグループトークです。" },
  event_calendar_export: { title: "イベントをカレンダーに追加", description: "端末の標準カレンダーへイベント日時を保存できます。" },
  availability_matching: { title: "みんなの日程調整", description: "任意の2人以上で空き時間を重ねて確認できます。" },
  lets_chat_booking: { title: "Let's Chat! 予約", description: "同じフロアの寮生がRAの空き時間を予約できます。" },
  unit_room_sessions: { title: "URS 日程調整", description: "ルームメイトとRAが全員集まれる時間を探せます。" },
  ra_question_box: { title: "RAへの質問箱", description: "質問への回答と、全寮生向けQ&Aの公開ができます。" },
  ra_link_hub: { title: "RAリンクページ", description: "外泊届やSNSなど、よく使うリンクをまとめて公開できます。" },
  wish_knowledge: { title: "WISH知恵袋", description: "質問ごとに閲覧・回答範囲を選べます。RAだけへの非公開相談も含みます。" },
  resident_directory: { title: "寮生ディレクトリ", description: "寮生を探す一覧ページ。本人のマイページは非公開設定後も利用できます。" },
  share_qr: { title: "共有QRコード", description: "リンクをQRコードにして共有。" },
  split_bill: { title: "割り勘", description: "合計金額から一人分の支払いを計算。" },
  group_shuffle: { title: "グループ分け", description: "参加者をランダムにチーム分け。" },
  world_clock: { title: "世界の時間", description: "離れた国との時差を確認。" },
  resident_events: { title: "寮生イベント募集", description: "ご飯や外出などの小さな集まりを寮生自身が募集できます。" },
};

export function FeatureFlagManager({ featureKey, initialState }: { featureKey: FeatureFlagKey; initialState: FeatureFlagState }) {
  const [state, setState] = useState(initialState);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const copy = featureCopy[featureKey];


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
    <div aria-busy={pending} className="min-w-0 px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${featureKey}-state`} className="min-w-0 text-sm font-semibold leading-snug">{copy.title}</label>
        <div className="relative w-28 shrink-0">
          <Select id={`${featureKey}-state`} value={state} disabled={pending} onChange={event => change(event.target.value as FeatureFlagState)} aria-describedby={`${featureKey}-description`} className="h-11 rounded-lg border-border bg-secondary/25 text-sm shadow-none">
            <option value="public">公開</option>
            <option value="beta">試験公開</option>
            <option value="hidden">非公開</option>
          </Select>
          {pending && <span role="status" className="absolute inset-0 flex items-center justify-center rounded-lg bg-card/90"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /><span className="sr-only">保存中</span></span>}
        </div>
      </div>
      <p id={`${featureKey}-description`} className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
    </div>
  );
}
