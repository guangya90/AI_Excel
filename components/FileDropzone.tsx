"use client";

import { useCallback, useRef, useState } from "react";

type FileDropzoneProps = {
  accept: string;
  maxBytes: number;
  disabled?: boolean;
  onFile: (file: File) => void;
  onError: (message: string) => void;
};

export function FileDropzone({ accept, maxBytes, disabled, onFile, onError }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
        onError("仅支持 .xlsx 或 .xls 文件。");
        return;
      }
      if (file.size > maxBytes) {
        onError(`文件不能超过 ${Math.round(maxBytes / 1024)}KB（当前限制 1MB）。`);
        return;
      }
      onFile(file);
    },
    [maxBytes, onError, onFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        handle(f);
      }}
      className={[
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 transition",
        dragOver ? "border-accent bg-blue-500/10" : "border-slate-600 bg-slate-900/40",
        disabled ? "pointer-events-none opacity-50" : "hover:border-accent-muted hover:bg-slate-900/60",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          handle(f);
          e.target.value = "";
        }}
      />
      <p className="text-center text-sm text-slate-200">
        拖拽 Excel 到此处，或 <span className="text-accent-muted">点击选择文件</span>
      </p>
      <p className="mt-2 text-center text-xs text-slate-500">支持 .xlsx / .xls，单文件 ≤ 1MB</p>
    </div>
  );
}
