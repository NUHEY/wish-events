import type { EventCategory } from "@/types/database";

export type SpreadsheetCell = string | number | boolean | Date | null;
export type SpreadsheetSheet = { sheet: string; data: SpreadsheetCell[][] };

export type EventImportDraft = {
  title?: string;
  category?: EventCategory;
  description?: string;
  location?: string;
  targetAudience?: string;
  eventDate?: string;
  capacity?: number;
  notes?: string;
  contactInfo?: string;
  organizerNames: string[];
  importedFields: string[];
  sourceSheet: string;
  warnings: string[];
};

const PLAN_MARKERS = ["イベント企画書", "企画名", "日時", "場所", "内容"];
const PERSON_LABELS = ["文責", "イベント部署", "会計部署", "統括"];

/** Google SheetsのCSV出力を、引用符内の改行や二重引用符を保ったまま行列へ戻す。 */
export function parseCsvRows(source: string): SpreadsheetCell[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function text(value: SpreadsheetCell | undefined): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  }
  return String(value).replaceAll("\t", " ").trim();
}

function compact(value: string) {
  return value.replaceAll(/\s+/g, " ").trim();
}

function sheetScore(sheet: SpreadsheetSheet) {
  const sample = sheet.data.slice(0, 20).flat().map(text).join("\n");
  return PLAN_MARKERS.reduce((score, marker) => score + (sample.includes(marker) ? 1 : 0), 0);
}

/** 報告書が右側に併記されている様式では、左側の「企画書」だけを取込対象にする。 */
function planningRows(sheet: SpreadsheetSheet): SpreadsheetCell[][] {
  const header = sheet.data[0] ?? [];
  const reportStart = header.findIndex((cell) => text(cell).includes("イベント報告書"));
  return reportStart > 0 ? sheet.data.map((row) => row.slice(0, reportStart)) : sheet.data;
}

function valueAfterLabel(rows: SpreadsheetCell[][], label: string, maxDistance = 7): SpreadsheetCell | undefined {
  for (const row of rows) {
    const labelIndex = row.findIndex((cell) => compact(text(cell)) === label);
    if (labelIndex < 0) continue;
    for (let index = labelIndex + 1; index <= Math.min(row.length - 1, labelIndex + maxDistance); index += 1) {
      if (text(row[index])) return row[index];
    }
  }
  return undefined;
}

function sectionBody(rows: SpreadsheetCell[][], marker: string) {
  const rowIndex = rows.findIndex((row) => row.some((cell) => text(cell).includes(marker)));
  if (rowIndex < 0) return "";
  for (let offset = 1; offset <= 4; offset += 1) {
    const value = rows[rowIndex + offset]?.map(text).find(Boolean);
    if (value) return value;
  }
  return "";
}

function inferCategory(title: string): EventCategory | undefined {
  if (title.includes("公式")) return "公式イベント";
  if (title.includes("フロア")) return "フロアイベント";
  if (/サポーター|募集/.test(title)) return "サポーター募集";
  if (/\bRR\b/i.test(title)) return "RR";
  if (/\bSI\b/i.test(title)) return "SI";
  return undefined;
}

function inferAudience(description: string) {
  const match = description.match(/([^。\n]{1,60})を主な対象(?:と|に)/);
  if (!match?.[1]) return "";
  return match[1]
    .replace(/^.*[「」『』]\s*/, "")
    .replace(/^.*(?:設定する|実施する|企画する)[。．]\s*/, "")
    .trim();
}

function parseCapacity(value: SpreadsheetCell | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(1, Math.round(value));
  const match = text(value).replaceAll(",", "").match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

function excelSerialToDate(value: number) {
  if (value < 30000 || value > 80000) return undefined;
  return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
}

function parseEventDate(dateValue: SpreadsheetCell | undefined, title: string, createdValue: SpreadsheetCell | undefined) {
  const raw = text(dateValue);
  const sourceDate = dateValue instanceof Date
    ? dateValue
    : typeof dateValue === "number"
      ? excelSerialToDate(dateValue)
      : undefined;
  const yearText = `${title} ${text(createdValue)} ${raw}`;
  const year = Number(yearText.match(/(20\d{2})/)?.[1]) || sourceDate?.getUTCFullYear() || new Date().getFullYear();
  const japaneseDate = raw.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  const numericDate = raw.match(/(?:20\d{2}[\/.\-])?(\d{1,2})[\/.\-](\d{1,2})/);
  const month = Number(japaneseDate?.[1] ?? numericDate?.[1]) || (sourceDate ? sourceDate.getUTCMonth() + 1 : 0);
  const day = Number(japaneseDate?.[2] ?? numericDate?.[2]) || sourceDate?.getUTCDate() || 0;
  const timeMatch = raw.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  const hour = Number(timeMatch?.[1] ?? 18);
  const minute = Number(timeMatch?.[2] ?? 0);
  if (!month || !day || month > 12 || day > 31 || hour > 23 || minute > 59) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeRangeNote(dateValue: SpreadsheetCell | undefined) {
  const matches = [...text(dateValue).matchAll(/(\d{1,2})\s*[:：]\s*(\d{2})/g)];
  if (matches.length < 2) return "";
  const start = `${String(Number(matches[0][1])).padStart(2, "0")}:${matches[0][2]}`;
  const end = `${String(Number(matches[1][1])).padStart(2, "0")}:${matches[1][2]}`;
  return `開催時間: ${start}〜${end}`;
}

function organizerNames(rows: SpreadsheetCell[][]) {
  const names: string[] = [];
  for (const label of PERSON_LABELS) {
    const value = compact(text(valueAfterLabel(rows, label, 3)));
    if (value && !names.includes(value)) names.push(value);
  }
  return names;
}

/**
 * WISHの公式イベント企画書を中心に、ラベル位置が多少移動しても読み取れるよう
 * セル番地ではなく「企画名」「日時」等の見出しから右方向の値を探す。
 */
export function parseEventWorkbook(sheets: SpreadsheetSheet[]): EventImportDraft {
  if (sheets.length === 0) throw new Error("シートが見つかりませんでした。");
  const source = [...sheets].sort((a, b) => sheetScore(b) - sheetScore(a))[0];
  const rows = planningRows(source);
  const title = compact(text(valueAfterLabel(rows, "企画名")));
  const description = text(valueAfterLabel(rows, "内容"));
  const location = compact(text(valueAfterLabel(rows, "場所")));
  const capacity = parseCapacity(valueAfterLabel(rows, "目標人数"));
  const dateValue = valueAfterLabel(rows, "日時");
  const eventDate = parseEventDate(
    dateValue,
    title,
    valueAfterLabel(rows, "作成日")
  );
  // 現在のイベントモデルは開始日時のみを持つため、企画書の終了時刻は備考に残す。
  const notes = [timeRangeNote(dateValue), sectionBody(rows, "備考")].filter(Boolean).join("\n\n").slice(0, 2000);
  const people = organizerNames(rows);
  const audience = inferAudience(description);
  const contactInfo = people.length > 0 ? `企画担当: ${people.join(" / ")}`.slice(0, 500) : "";
  const category = inferCategory(title);

  const importedFields = [
    title && "企画名",
    category && "カテゴリ",
    description && "内容",
    location && "場所",
    audience && "対象者",
    eventDate && "開催日時",
    capacity && "定員",
    notes && "備考",
    contactInfo && "企画担当",
  ].filter((field): field is string => Boolean(field));
  const warnings = [
    !title && "企画名を見つけられませんでした。",
    !eventDate && "開催日時を特定できませんでした。",
  ].filter((warning): warning is string => Boolean(warning));

  return {
    ...(title ? { title } : {}),
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    ...(location ? { location } : {}),
    ...(audience ? { targetAudience: audience } : {}),
    ...(eventDate ? { eventDate } : {}),
    ...(capacity ? { capacity } : {}),
    ...(notes ? { notes } : {}),
    ...(contactInfo ? { contactInfo } : {}),
    organizerNames: people,
    importedFields,
    sourceSheet: source.sheet,
    warnings,
  };
}
