import { CalendarClock, CalendarPlus, Lightbulb, Link2, MessagesSquare, UsersRound, QrCode, Calculator, Shuffle, Globe2 } from "lucide-react";
import { defaultFeatureState, type FeatureFlagKey, type FeatureFlagState } from "@/lib/feature-flag-keys";

export type ToolKey = FeatureFlagKey;
export type HomeToolPreference = { key: ToolKey; showOnHome: boolean };

export const RESIDENT_TOOLS: {
  key: ToolKey;
  featureKey?: FeatureFlagKey;
  createHref: string;
  residentHref: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  residentDescription?: string;
  residentDescriptionEn?: string;
  icon: typeof CalendarClock;
  accent: string;
  raCreates: boolean;
}[] = [
  { key: "resident_events", featureKey: "resident_events", createHref: "/events/community", residentHref: "/events/community", title: "イベントを募集", titleEn: "Create a meetup", description: "ご飯や外出の仲間を気軽に募集", descriptionEn: "Invite others to dinner, outings, and more", icon: CalendarPlus, accent: "from-pink-400/15 to-violet-300/5 text-pink-700 dark:text-pink-300", raCreates: false },
  { key: "resident_directory", featureKey: "resident_directory", createHref: "/directory", residentHref: "/directory", title: "寮生ディレクトリ", titleEn: "Resident directory", description: "共通の言語や関心から友達を探す", descriptionEn: "Find people through shared languages and interests", icon: UsersRound, accent: "from-teal-500/15 to-sky-400/5 text-teal-700 dark:text-teal-300", raCreates: false },
  { key: "availability_matching", featureKey: "availability_matching", createHref: "/tools/schedule/new?mode=general", residentHref: "/tools/schedule/new?mode=general", title: "みんなの日程調整", titleEn: "Find a time together", description: "2人以上の空き時間を重ねて確認", descriptionEn: "Compare availability for two or more people", icon: CalendarClock, accent: "from-sky-500/15 to-cyan-400/5 text-sky-700 dark:text-sky-300", raCreates: false },
  { key: "lets_chat_booking", featureKey: "lets_chat_booking", createHref: "/tools/schedule/new?mode=lets_chat", residentHref: "/tools#active-schedules", title: "Let's Chat!", titleEn: "Let's Chat!", description: "フロアRAの予約ページを作成", descriptionEn: "Create booking slots for your floor", residentDescription: "フロアRAが公開した時間から予約", residentDescriptionEn: "Book a time published by your floor RA", icon: MessagesSquare, accent: "from-rose-500/15 to-orange-400/5 text-rose-700 dark:text-rose-300", raCreates: true },
  { key: "unit_room_sessions", featureKey: "unit_room_sessions", createHref: "/tools/schedule/new?mode=urs", residentHref: "/tools#active-schedules", title: "URS 日程調整", titleEn: "Schedule a URS", description: "ルームメイトとRAの日程ページを作成", descriptionEn: "Coordinate a room session with roommates and an RA", residentDescription: "RAが公開したページに予定を入力", residentDescriptionEn: "Enter your availability on the RA's page", icon: UsersRound, accent: "from-violet-500/15 to-fuchsia-400/5 text-violet-700 dark:text-violet-300", raCreates: true },
  { key: "ra_link_hub", featureKey: "ra_link_hub", createHref: "/links", residentHref: "/links", title: "RAリンクページ", titleEn: "RA links", description: "外泊届・SNS・よく使うページ", descriptionEn: "Overnight forms, social accounts, and useful pages", icon: Link2, accent: "from-emerald-500/15 to-teal-400/5 text-emerald-700 dark:text-emerald-300", raCreates: false },
  { key: "wish_knowledge", featureKey: "wish_knowledge", createHref: "/wisdom", residentHref: "/wisdom", title: "WISH知恵袋", titleEn: "WISH Knowledge", description: "寮生活の疑問を共有・RAだけへの相談も", descriptionEn: "Share dorm questions or ask RAs privately", icon: Lightbulb, accent: "from-amber-400/15 to-lime-300/5 text-amber-700 dark:text-amber-300", raCreates: false },
  { key: "share_qr", featureKey: "share_qr", createHref: "/tools/share", residentHref: "/tools/share", title: "共有QRコード", titleEn: "Share a QR code", description: "イベントや予約のリンクを掲示物に", descriptionEn: "Turn event and booking links into a QR code", icon: QrCode, accent: "from-indigo-500/15 to-indigo-400/5 text-indigo-700 dark:text-indigo-300", raCreates: false },
  { key: "split_bill", featureKey: "split_bill", createHref: "/tools/split-bill", residentHref: "/tools/split-bill", title: "割り勘", titleEn: "Split a bill", description: "合計金額から一人分の支払いを計算", descriptionEn: "Work out how much each person pays", icon: Calculator, accent: "from-emerald-500/15 to-emerald-400/5 text-emerald-700 dark:text-emerald-300", raCreates: false },
  { key: "group_shuffle", featureKey: "group_shuffle", createHref: "/tools/groups", residentHref: "/tools/groups", title: "グループ分け", titleEn: "Make groups", description: "参加者をランダムにチーム分け", descriptionEn: "Randomly split participants into teams", icon: Shuffle, accent: "from-orange-500/15 to-orange-400/5 text-orange-700 dark:text-orange-300", raCreates: false },
  { key: "world_clock", featureKey: "world_clock", createHref: "/tools/world-clock", residentHref: "/tools/world-clock", title: "世界の時間", titleEn: "World clock", description: "離れた国の友達と時差を確認", descriptionEn: "Compare the time where your friends live", icon: Globe2, accent: "from-sky-500/15 to-sky-400/5 text-sky-700 dark:text-sky-300", raCreates: false },
];

/** Preserve saved order and append newly available tools without losing existing choices. */
export function resolveHomeTools(
  preferences: HomeToolPreference[] | null,
  rows: { key: string; state: FeatureFlagState; show_on_home: boolean; home_position: number }[],
) {
  const rowsByKey = new Map(rows.map(row => [row.key, row]));
  const lastPosition = Math.max(0, ...rows.map(row => row.home_position || 0));
  const defaults = RESIDENT_TOOLS.map((tool, index) => {
    const row = tool.featureKey ? rowsByKey.get(tool.featureKey) : undefined;
    return { key: tool.key, state: tool.featureKey ? row?.state ?? defaultFeatureState(tool.featureKey) : "public" as FeatureFlagState,
      showOnHome: row?.show_on_home ?? (!tool.featureKey || defaultFeatureState(tool.featureKey) === "public"), position: row?.home_position || lastPosition + index + 1 };
  }).sort((a, b) => a.position - b.position);
  if (!preferences) return defaults;
  const byKey = new Map(defaults.map(tool => [tool.key, tool]));
  const seen = new Set<ToolKey>();
  const ordered = preferences.flatMap(preference => {
    const tool = byKey.get(preference.key);
    if (!tool || seen.has(tool.key)) return [];
    seen.add(tool.key);
    return [{ ...tool, showOnHome: preference.showOnHome }];
  });
  return [...ordered, ...defaults.filter(tool => !seen.has(tool.key))].map((tool, index) => ({ ...tool, position: index + 1 }));
}
