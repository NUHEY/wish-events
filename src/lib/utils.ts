import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "#RRGGBB" を rgba(r, g, b, alpha) 文字列に変換する。 */
export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** "#RRGGBB" をCSSカスタムプロパティ用の "H S% L%" 形式(HSL)に変換する。 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * マイページのアクセントカラー（最大5色）から、カードの背景に敷く
 * 「見えるか分からないほど薄い」グラデーションを組み立てる。
 * 色が1つなら単色のごく淡いグラデーション、複数なら等間隔に並べる。
 */
export function buildAccentBackgroundGradient(hexList: string[], alpha = 0.07): string | null {
  if (hexList.length === 0) return null;
  if (hexList.length === 1) {
    const c = hexToRgba(hexList[0], alpha);
    return `linear-gradient(135deg, ${c}, transparent 70%)`;
  }
  const stops = hexList
    .map((hex, i) => `${hexToRgba(hex, alpha)} ${Math.round((i / (hexList.length - 1)) * 100)}%`)
    .join(", ");
  return `linear-gradient(135deg, ${stops})`;
}

/**
 * EventCard の表示に必要な列だけを絞った select 文字列。
 * イベント一覧系のページで "*" の代わりに使うことで、説明文や対象者情報など
 * 一覧では使わない列の転送・シリアライズを省き、表示速度を改善する。
 */
export const EVENT_CARD_COLUMNS =
  "id, title, title_en, category, poster_url, thumbnail_url, creator_type, fee_amount, show_free_tag, event_date, publish_at, created_at, registration_closes_at" as const;

/** "301A" のように floor_number + room_number を結合して表示用の部屋番号を作る */
export function formatRoomNumber(
  floorNumber: number | null,
  roomNumber: string | null
): string {
  if (floorNumber == null || !roomNumber) return "-";
  return `${floorNumber}${roomNumber}`;
}

/**
 * "301A"（3階）や "1122C"（11階）のようにドア表示のまま入力された文字列を
 * floor_number + room_number に分解する（寮生管理画面の検索ショートカット用）。
 * 1桁の階(3-9)と2桁の階(10-11)のどちらも「1」始まりの階が存在しないため、
 * 2パターンの間で解釈が曖昧になることはない（例: "1107" は11階07号室のみ）。
 */
const FULL_ROOM_NUMBER_REGEX = /^(3|4|5|6|7|8|9|10|11)([0-9]{2})([A-D])?$/;

export function parseFullRoomNumber(
  input: string
): { floorNumber: number; roomNumber: string } | null {
  const trimmed = input.trim().toUpperCase();
  const match = FULL_ROOM_NUMBER_REGEX.exec(trimmed);
  if (!match) return null;
  const floorNumber = Number(match[1]);
  const roomNumber = `${match[2]}${match[3] ?? ""}`;
  return { floorNumber, roomNumber };
}

/**
 * このサイトの利用者は全員日本国内(WISH寮)にいる前提のため、日時は常に
 * JST(Asia/Tokyo, UTC+9固定・サマータイム無し)で保存・表示を統一する。
 *
 * 注意: Server Component/Server ActionはNode.jsサーバー上で実行されるため、
 * `new Date(...).getHours()`のようなローカルタイムゾーン依存のメソッドは
 * サーバーの実行タイムゾーン（多くの場合UTC）に左右され、RAが入力した時刻と
 * 寮生が閲覧する時刻がズレる原因になる。そのため日時のやり取りは
 * 必ずこのファイルのヘルパー経由でJSTに固定して行うこと。
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * UTC ISO文字列（またはDate）を「JSTの壁時計時刻」を表すDateにシフトする内部ヘルパー。
 * シフト後のDateに対してgetUTCXXX()を呼ぶと、実行環境のタイムゾーンに関わらず
 * 常にJSTでの年月日時分が得られる。
 */
function shiftToJstWallClock(input: string | Date): Date {
  const t = typeof input === "string" ? new Date(input).getTime() : input.getTime();
  return new Date(t + JST_OFFSET_MS);
}

/**
 * DateTimePicker等が出す"YYYY-MM-DDTHH:mm"形式の壁時計文字列を、
 * それがJSTとして入力されたものとみなし、DB保存用のUTC ISO文字列に変換する。
 * （`new Date("YYYY-MM-DDTHH:mm").toISOString()`のような単純変換は、
 * Server Action実行環境のタイムゾーン扱いになってしまい不正確なため使わない）
 */
export function jstWallClockToUtcIso(value: string): string {
  return new Date(`${value}:00+09:00`).toISOString();
}

/**
 * DBに保存されたUTC ISO文字列を、DateTimePickerのdefaultValueに渡すための
 * "YYYY-MM-DDTHH:mm"形式のJST壁時計文字列に変換する。
 * （`new Date(iso).toISOString().slice(0, 16)`はUTCのままなので使わない）
 */
export function utcIsoToJstWallClockInput(iso: string): string {
  const d = shiftToJstWallClock(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/**
 * 日時を整形する（常にJSTで表示）。
 * ja: "2026年8月24日(月) 18:00"
 * en: "Aug 24, 2026 (Mon) 18:00"
 */
/**
 * イベントの日時をロケールに応じて整形する。
 * includeYear: 直近のイベントは年を省略してスペースを節約し、
 *   過去イベント（一覧で年度の文脈が欲しい）ではtrueにする。
 * includeTime: 過去イベントの一覧セルでは時刻まで表示する必要が薄いためfalseにできる。
 * 両方省略した場合は従来通り年・時刻とも表示する（既存の呼び出し箇所との互換性維持）。
 */
export function formatEventDateTime(
  iso: string,
  locale: "ja" | "en" = "ja",
  includeYear: boolean = true,
  includeTime: boolean = true
): string {
  const d = shiftToJstWallClock(iso);
  const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

  if (locale === "en") {
    const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsEn = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const datePart = includeYear
      ? `${monthsEn[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
      : `${monthsEn[d.getUTCMonth()]} ${d.getUTCDate()}`;
    return `${datePart} (${weekdaysEn[d.getUTCDay()]})${includeTime ? ` ${time}` : ""}`;
  }

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const datePart = includeYear
    ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
    : `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  return `${datePart}(${weekdays[d.getUTCDay()]})${includeTime ? ` ${time}` : ""}`;
}

/**
 * 「今週」の終わり（JSTの日曜 23:59:59.999）に対応するUTC時刻を返す。
 * ホームの「今週のイベント」セクションで、現在時刻から今週末までに開催される
 * イベントを絞り込むために使う。サーバーの実行タイムゾーンに関わらずJST基準の
 * 「週」になるよう、JST壁時計時刻で計算してからUTCに戻す。
 */
/** お知らせのタグが「重要」系かどうか（一覧・詳細で強調表示するため）。 */
export function isImportantTag(tag: string): boolean {
  return /重要|important/i.test(tag);
}

/**
 * DM画像バケット(dm-media)のフォルダ名・リアルタイムチャンネル名に使う、
 * 2人のuser_idの組を正規化した文字列（順序に依存しない）。
 * can_access_dm_media(text)のパース対象と対応させる。
 */
export function dmPairFolder(userIdA: string, userIdB: string) {
  return [userIdA, userIdB].sort().join("_");
}

/** UTC ISO文字列をJST基準の"YYYY-MM-DD"に変換する。イベント検索カレンダーの日付グルーピングに使う。 */
export function toJstDateKey(iso: string): string {
  const jst = shiftToJstWallClock(iso);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function endOfThisWeek(from: Date = new Date()): Date {
  const jst = shiftToJstWallClock(from);
  const day = jst.getUTCDay(); // 0=日 〜 6=土（JST基準）
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  const endOfWeekAsJstNaiveUtc = Date.UTC(
    jst.getUTCFullYear(),
    jst.getUTCMonth(),
    jst.getUTCDate() + daysUntilSunday,
    23, 59, 59, 999
  );
  return new Date(endOfWeekAsJstNaiveUtc - JST_OFFSET_MS);
}

/** オブジェクトの配列をCSV文字列に変換する（Excel対応のためUTF-8 BOM付き） */
export function toCsv(
  rows: Record<string, string | number | null | undefined>[],
  headers: { key: string; label: string }[]
): string {
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.map((h) => escape(h.label)).join(",");
  const lines = rows.map((row) =>
    headers.map((h) => escape(row[h.key])).join(",")
  );
  return "﻿" + [headerLine, ...lines].join("\n");
}

/** ブラウザ上でCSV文字列をファイルとしてダウンロードさせる */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
