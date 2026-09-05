import type { UserAccountKind } from "@/types/database";

export const MANAGEMENT_MODULES = [
  { key: "events", group: "content", href: "/dashboard", ja: "イベント", en: "Events", detailJa: "作成・編集・削除、参加者・集金・アンケート・トーク管理", detailEn: "Create, edit, delete, participants, payments, surveys and event talks" },
  { key: "announcements", group: "content", href: "/dashboard/new-announcement", ja: "お知らせ", en: "Announcements", detailJa: "お知らせの投稿・編集・削除", detailEn: "Post, edit and delete announcements" },
  { key: "notifications", group: "content", href: "/dashboard/notifications", ja: "通知の配信", en: "Broadcasts", detailJa: "対象を選んで寮生へ通知を送信", detailEn: "Send notifications to selected residents" },
  { key: "schedules", group: "community", href: "/dashboard/schedules", ja: "日程・予約", en: "Schedules & bookings", detailJa: "日程の作成・管理、予約・実施状況の確認", detailEn: "Create and manage schedules, bookings and completion status" },
  { key: "questions", group: "community", href: "/dashboard/questions", ja: "知恵袋の管理", en: "Knowledge moderation", detailJa: "公開質問の確認・削除（RA限定の閲覧・回答はRA専用）", detailEn: "Review and delete public questions; RA-only viewing and answers stay exclusive to RAs" },
  { key: "links", group: "community", href: "/dashboard/link-hub", ja: "リンクページ", en: "Link pages", detailJa: "自分の共有リンクページを作成・編集", detailEn: "Create and edit your own shared link page" },
  { key: "badges", group: "community", href: "/dashboard/badges", ja: "バッジ", en: "Badges", detailJa: "バッジの追加・編集・削除、獲得条件の設定", detailEn: "Add, edit and delete badges and set criteria" },
  { key: "residents", group: "people", href: "/dashboard/residents", ja: "寮生情報", en: "Resident records", detailJa: "連絡先・学籍情報・部屋の閲覧、一般寮生の退寮処理", detailEn: "View contact, student and room details; release ordinary residents’ rooms" },
  { key: "home", group: "site", href: "/dashboard/home-layout", ja: "ホームの編集", en: "Home layout", detailJa: "ホームに載せる内容と並び順を変更", detailEn: "Change home content and ordering" },
  { key: "event_options", group: "site", href: "/dashboard/event-options", ja: "イベントの選択肢", en: "Event options", detailJa: "会場・対象など、作成フォームの選択肢を管理", detailEn: "Manage venue and audience choices" },
  { key: "features", group: "site", href: "/dashboard/features", ja: "機能の公開範囲", en: "Feature visibility", detailJa: "各機能の非公開・試験公開・公開を切り替え", detailEn: "Choose hidden, beta or public visibility" },
  { key: "settings", group: "site", href: "/dashboard/settings", ja: "サイトの表示設定", en: "Site appearance", detailJa: "共有画像・色・動き・日程の初期設定を変更", detailEn: "Change sharing images, colors, motion and schedule defaults" },
] as const;
export type ManagementPermission = typeof MANAGEMENT_MODULES[number]["key"];
export const MANAGEMENT_KEYS: ManagementPermission[] = MANAGEMENT_MODULES.map((module) => module.key);
export const MANAGEMENT_GROUPS = [
  {key:"content", ja:"投稿・配信", en:"Content & messages"},
  {key:"community", ja:"寮生活のサポート", en:"Dorm life support"},
  {key:"people", ja:"寮生・権限", en:"Residents & access"},
  {key:"site", ja:"サイトの設定", en:"Site settings"},
] as const;
export function isManagementPermission(value: unknown): value is ManagementPermission {
  return typeof value === "string" && MANAGEMENT_KEYS.includes(value as ManagementPermission);
}
export function isInstitutionalKind(kind: unknown): kind is Exclude<UserAccountKind, "resident"> {
  return kind === "service_desk" || kind === "university_staff";
}
export type ManagementAccess = { isRa: boolean; permissions: ManagementPermission[] };
export function canManage(access: ManagementAccess, permission: ManagementPermission): boolean {
  return access.isRa || access.permissions.includes(permission);
}
