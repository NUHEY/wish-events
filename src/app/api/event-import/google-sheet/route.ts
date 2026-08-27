import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCsvRows, parseEventWorkbook } from "@/lib/event-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const SHEET_PATH = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/;

function googleSheetExportUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Google SheetsのURLを入力してください。");
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw new Error("docs.google.com のスプレッドシートURLだけを利用できます。");
  }
  const id = url.pathname.match(SHEET_PATH)?.[1];
  if (!id) throw new Error("Google Sheetsの共有URLを確認してください。");
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const gid = url.searchParams.get("gid") ?? hashParams.get("gid");
  const exportUrl = new URL(`https://docs.google.com/spreadsheets/d/${id}/export`);
  exportUrl.searchParams.set("format", "csv");
  if (gid && /^\d+$/.test(gid)) exportUrl.searchParams.set("gid", gid);
  return exportUrl;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  const { data: profile } = await supabase.from("users").select("role").eq("id", authData.user.id).maybeSingle();
  if (profile?.role !== "ra") return NextResponse.json({ error: "RAのみ利用できます。" }, { status: 403 });

  try {
    const body = (await request.json()) as { url?: unknown };
    const exportUrl = googleSheetExportUrl(String(body.url ?? "").trim());
    const response = await fetch(exportUrl, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { "User-Agent": "WISH-Events-Sheet-Importer/1.0" },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "シートを取得できませんでした。リンクを知っている全員が閲覧できる共有設定か確認してください。" },
        { status: 422 }
      );
    }
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_CSV_BYTES) {
      return NextResponse.json({ error: "シートが大きすぎます。5MB以内にしてください。" }, { status: 413 });
    }
    const csv = await response.text();
    if (new TextEncoder().encode(csv).byteLength > MAX_CSV_BYTES) {
      return NextResponse.json({ error: "シートが大きすぎます。5MB以内にしてください。" }, { status: 413 });
    }
    if (/<!doctype html|<html/i.test(csv.slice(0, 500))) {
      return NextResponse.json(
        { error: "Googleのログイン画面が返されました。シートの共有範囲を確認してください。" },
        { status: 422 }
      );
    }
    const draft = parseEventWorkbook([{ sheet: "Google Sheets", data: parseCsvRows(csv) }]);
    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "Google Sheetsの取得がタイムアウトしました。もう一度お試しください。"
      : error instanceof Error
        ? error.message
        : "シートを読み取れませんでした。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
