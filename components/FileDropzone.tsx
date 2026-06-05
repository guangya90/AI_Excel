"use client";

import { useCallback, useRef, useState } from "react";

type FileDropzoneProps = {
  disabled?: boolean;
  onFile: (file: File) => void;
  onError: (message: string) => void;
};

const SUPPORTED_EXTENSIONS = [".xlsx", ".xls", ".docx", ".pdf"];
const SUPPORTED_LABEL = "Excel (.xlsx/.xls)、Word (.docx)、PDF";

export function FileDropzone({ disabled, onFile, onError }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const lower = file.name.toLowerCase();
      const ext = SUPPORTED_EXTENSIONS.find((e) => lower.endsWith(e));
      if (!ext) {
        onError(`不支持的文件格式（${file.name.split(".").pop()}），请上传 ${SUPPORTED_LABEL} 文件。`);
        return;
      }
      onFile(file);
    },
    [onFile, onError],
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
        "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 transition-all duration-200",
        dragOver
          ? "border-[#0fc6c2] bg-[#e8fafa] scale-[1.02] shadow-lg"
          : "border-gray-200 bg-white hover:border-[#0fc6c2]/50 hover:bg-[#e8fafa]/30",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.docx,.pdf"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          handle(f);
          e.target.value = "";
        }}
      />

      {/* Upload icon */}
      <div className="w-16 h-16 rounded-2xl bg-[#e8fafa] flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-[#0fc6c2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>

      <p className="text-center text-sm text-gray-600 font-medium">
        拖拽文件到此处，或 <span className="text-[#0fc6c2] font-semibold hover:underline">点击选择文件</span>
      </p>
      <p className="mt-2 text-center text-xs text-gray-400">
        支持 {SUPPORTED_LABEL}
      </p>

      {/* Format tags */}
      <div className="flex gap-2 mt-3">
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">Excel</span>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Word</span>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">PDF</span>
      </div>
    </div>
  );
}
