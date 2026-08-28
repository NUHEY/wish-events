/**
 * 未設定時のデフォルト画像（早稲田大学国際学生寮WISHをイメージしたブランド画像）。
 * マイページの背景（カバー）画像はユーザー要望により対象外（画像なしのままでよい）。
 */
export const DEFAULT_EVENT_IMAGE_URL = "/images/default-event.jpg";
export const DEFAULT_AVATAR_IMAGE_URL = "/images/default-avatar.jpg";

/** 新規イベントで画像がない場合に選べる、文字を含まない穏やかな既定ビジュアル。 */
export const DEFAULT_EVENT_PRESETS = [
  { id: "community", label: "コミュニティ", url: "/images/event-presets/community.svg" },
  { id: "conversation", label: "交流", url: "/images/event-presets/conversation.svg" },
  { id: "creative", label: "カルチャー", url: "/images/event-presets/creative.svg" },
  { id: "evening", label: "イブニング", url: "/images/event-presets/evening.svg" },
] as const;
