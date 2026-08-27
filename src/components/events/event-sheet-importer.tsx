"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Link2, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-provider";
import { parseEventWorkbook, type EventImportDraft, type SpreadsheetSheet } from "@/lib/event-import";

const MAX_FILE_BYTES = 30 * 1024 * 1024;

export function EventSheetImporter({ onImported }: { onImported: (draft: EventImportDraft) => void }) {
  const locale = useLocale();
  const isJa = locale === "ja";
  const fileRef = useRef<HTMLInputElement>(null);
  const [googleUrl, setGoogleUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<"file" | "google" | null>(null);
  const [result, setResult] = useState<EventImportDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  function apply(draft: EventImportDraft) {
    if (draft.importedFields.length === 0) throw new Error(isJa ? "入力できる項目を見つけられませんでした。" : "No importable fields were found.");
    setResult(draft);
    setError(null);
    onImported(draft);
    toast.success(isJa ? `${draft.importedFields.length}項目を入力しました` : `Filled ${draft.importedFields.length} fields`);
  }

  async function importFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError(isJa ? ".xlsx形式のExcelファイルを選択してください。" : "Choose an .xlsx Excel file.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(isJa ? "Excelファイルは30MB以内にしてください。" : "Excel files must be 30 MB or smaller.");
      return;
    }
    setPending("file");
    setError(null);
    try {
      // 通常表示のバンドルを重くしないよう、Excel解析機能は取込時だけ読み込む。
      // 大きなxlsxの展開はライブラリ内のWeb Workerで行われ、画面操作を止めない。
      const { default: readXlsxFile } = await import("read-excel-file/browser");
      const sheets = await readXlsxFile(file);
      apply(parseEventWorkbook(sheets as SpreadsheetSheet[]));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : (isJa ? "Excelを読み取れませんでした。" : "Could not read the Excel file.");
      setError(message);
    } finally {
      setPending(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function importGoogleSheet() {
    if (!googleUrl.trim()) return;
    setPending("google");
    setError(null);
    try {
      const response = await fetch("/api/event-import/google-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: googleUrl.trim() }),
      });
      const payload = (await response.json()) as { draft?: EventImportDraft; error?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error || (isJa ? "Google Sheetsを読み取れませんでした。" : "Could not read Google Sheets."));
      apply(payload.draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (isJa ? "Google Sheetsを読み取れませんでした。" : "Could not read Google Sheets."));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-secondary/35 shadow-sm">
      <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><FileSpreadsheet className="h-5 w-5" /></span>
        <div>
          <h2 className="text-sm font-bold">{isJa ? "企画書から自動入力" : "Auto-fill from an event plan"}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{isJa ? "ExcelまたはGoogle Sheetsから、企画名・日時・場所・内容・定員などを読み取ります。" : "Read the title, date, location, description, capacity, and more from Excel or Google Sheets."}</p>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void importFile(file);
          }}
          className={cn(
            "flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition-[border-color,background-color,transform]",
            dragging ? "scale-[0.99] border-primary bg-primary/10" : "border-border bg-background/70"
          )}
        >
          <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); }} />
          {pending === "file" ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <UploadCloud className="h-7 w-7 text-primary" />}
          <p className="mt-2 text-sm font-semibold">{pending === "file" ? (isJa ? "Excelを解析中…" : "Reading Excel…") : (isJa ? "ここにExcelをドロップ" : "Drop Excel here")}</p>
          <p className="mt-1 text-xs text-muted-foreground">.xlsx・30MBまで</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" disabled={pending !== null} onClick={() => fileRef.current?.click()}>{isJa ? "ファイルを選ぶ" : "Choose file"}</Button>
          <p className="mt-2 text-[10px] text-muted-foreground">{isJa ? "ファイルはサーバーへ保存されません" : "The file is not stored on the server"}</p>
        </div>

        <div className="flex min-h-40 flex-col justify-center rounded-xl border border-border bg-background/70 p-4">
          <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><Label htmlFor="google-sheet-url">Google Sheets URL</Label></div>
          <Input
            id="google-sheet-url"
            type="url"
            value={googleUrl}
            onChange={(event) => setGoogleUrl(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void importGoogleSheet(); } }}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="mt-2 h-11 rounded-xl"
          />
          <Button type="button" className="mt-3" disabled={pending !== null || !googleUrl.trim()} onClick={() => void importGoogleSheet()}>
            {pending === "google" && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending === "google" ? (isJa ? "読み取り中…" : "Reading…") : (isJa ? "URLから読み取る" : "Import from URL")}
          </Button>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{isJa ? "「リンクを知っている全員が閲覧可」にしたシートに対応します。" : "The sheet must be viewable by anyone with the link."}</p>
        </div>
      </div>

      {error && <p role="alert" className="mx-4 mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>}
      {result && (
        <div className="mx-4 mb-4 rounded-xl border border-success/20 bg-success/5 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-success"><CheckCircle2 className="h-4 w-4" />{isJa ? `${result.sourceSheet}から入力しました` : `Imported from ${result.sourceSheet}`}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{result.importedFields.map((field) => <span key={field} className="rounded-full bg-card px-2 py-1 text-[10px] font-medium text-card-foreground shadow-sm">{field}</span>)}</div>
          {result.warnings.map((warning) => <p key={warning} className="mt-2 text-[10px] text-muted-foreground">※ {warning}</p>)}
          <p className="mt-2 text-[10px] text-muted-foreground">{isJa ? "入力内容を確認し、不足項目や表現を調整してから保存してください。" : "Review and adjust the imported fields before saving."}</p>
        </div>
      )}
    </section>
  );
}
