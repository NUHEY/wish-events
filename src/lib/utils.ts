import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
 * 日時を整形する。
 * ja: "2026年8月24日(月) 18:00"
 * en: "Aug 24, 2026 (Mon) 18:00"
 */
export function formatEventDateTime(iso: string, locale: "ja" | "en" = "ja"): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  if (locale === "en") {
    const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsEn = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${monthsEn[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} (${weekdaysEn[d.getDay()]}) ${time}`;
  }

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]}) ${time}`;
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
