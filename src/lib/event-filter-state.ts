import { EVENT_CATEGORIES } from "@/lib/constants";

export type EventFilterDraft = {
  category: string;
  timing: "all" | "upcoming" | "past" | "custom";
  dateMode: "single" | "range" | "month";
  date: string;
  from: string;
  to: string;
  month: string;
};
export const EMPTY_EVENT_FILTER: EventFilterDraft = { category: "", timing: "all", dateMode: "single", date: "", from: "", to: "", month: "" };
const DATE_KEYS = ["date", "from", "to", "month"];
export function readEventFilter(params: URLSearchParams): EventFilterDraft {
  const status = params.get("status");
  const date = params.get("date") || "";
  const from = params.get("from") || "";
  const to = params.get("to") || "";
  const month = params.get("month") || "";
  return { category: params.get("category") || "", timing: date || from || to || month ? "custom" : status === "upcoming" || status === "past" ? status : "all", dateMode: date ? "single" : from || to ? "range" : month ? "month" : "single", date, from, to, month };
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function eventFilterError(draft: EventFilterDraft): "date" | "range" | "month" | null {
  if (draft.timing !== "custom") return null;
  if (draft.dateMode === "single") return validDate(draft.date) ? null : "date";
  if (draft.dateMode === "month") return /^\d{4}-(0[1-9]|1[0-2])$/.test(draft.month) ? null : "month";
  if ((!draft.from && !draft.to) || (draft.from && !validDate(draft.from)) || (draft.to && !validDate(draft.to)) || (draft.from && draft.to && draft.from > draft.to)) return "range";
  return null;
}
/** Apply all choices in one navigation, preserving the separate keyword search. */
export function eventFilterParams(current: URLSearchParams, draft: EventFilterDraft) {
  const params = new URLSearchParams(current);
  for (const key of ["category", "status", ...DATE_KEYS]) params.delete(key);
  if (EVENT_CATEGORIES.some(category => category === draft.category)) params.set("category", draft.category);
  if (draft.timing === "upcoming" || draft.timing === "past") params.set("status", draft.timing);
  if (draft.timing === "custom" && !eventFilterError(draft)) {
    if (draft.dateMode === "single") params.set("date", draft.date);
    else if (draft.dateMode === "month") params.set("month", draft.month);
    else {
      if (draft.from) params.set("from", draft.from);
      if (draft.to) params.set("to", draft.to);
    }
  }
  return params;
}
