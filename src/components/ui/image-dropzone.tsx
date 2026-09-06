"use client";

import { useRef, useState } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImageDropzone({
  value,
  onFile,
  disabled = false,
  label = "画像を追加",
  hint = "JPG・PNG・WebP／推奨 4:3 または 1:1／10MB以下",
  previewClassName = "object-contain",
  className,
  compact = false,
}: {
  value: string;
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  previewClassName?: string;
  className?: string;
  /** A small upload control for forms that render a separate, unobstructed preview. */
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept(file: File | undefined) {
    if (!disabled && file && file.type.startsWith("image/")) onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept(e.dataTransfer.files[0]);
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          if (!disabled) inputRef.current?.click();
        }
      }}
      onClick={() => { if (!disabled) inputRef.current?.click(); }}
      className={cn(
        "relative flex min-h-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed p-4 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border bg-secondary/25 hover:border-primary/50 hover:bg-secondary/45",
        disabled && "pointer-events-none opacity-60",
        compact && "min-h-0 rounded-xl p-3",
        className
      )}
    >
      {compact ? (
        <span className="flex min-h-11 w-full min-w-0 items-center gap-3 text-left">
          <Upload className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0"><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span></span>
        </span>
      ) : value ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="アップロード画像のプレビュー" className={cn("absolute inset-0 h-full w-full", previewClassName)} />
          <span className="absolute inset-x-0 bottom-0 bg-foreground/75 px-3 py-2 text-xs font-medium text-background">
            クリックまたはドロップして画像を変更
          </span>
        </>
      ) : (
        <>
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">クリックまたはドラッグ＆ドロップ</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            <Upload className="h-3.5 w-3.5" />
            ファイルを選択
          </span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        disabled={disabled}
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
