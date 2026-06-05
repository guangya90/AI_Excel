// ============================================================
// 多格式文件解析器 — 统一抽象入口
// ============================================================

import type { ParsedDocument } from "./rule-types";
import { parseExcelFile } from "./excel-parser";
import { parseWordFile } from "./word-parser";
import { parsePdfFile } from "./pdf-parser";

/** 解析结果（含元信息） */
export interface FileParseResult {
  document: ParsedDocument;
  /** 用于 AI 分析的结构化摘要 */
  aiSummary: {
    fileName: string;
    fileFormat: string;
    sheetNames: string[];
    headerPreview: string;
    sampleRows: string;
    totalRows: number;
    totalCols: number;
    textContent?: string;
    /** 提取出的头表键值对（发给AI） */
    extractedKVs?: Record<string, string>;
  };
}

/** 支持的文件扩展名映射 */
const FORMAT_MAP: Record<string, ParsedDocument["sourceFormat"]> = {
  xlsx: "xlsx",
  xls: "xls",
  docx: "docx",
  pdf: "pdf",
};

/**
 * 统一文件解析入口
 */
export async function parseFile(
  file: File,
  options?: { maxRows?: number; sheetIndex?: number },
): Promise<FileParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_MAP[ext] ?? "xlsx";

  let document: ParsedDocument;

  switch (format) {
    case "xlsx":
    case "xls":
      document = await parseExcelFile(file, options);
      break;
    case "docx":
      document = await parseWordFile(file);
      break;
    case "pdf":
      document = await parsePdfFile(file);
      break;
    default:
      throw new Error(`不支持的文件格式：${ext}`);
  }

  const aiSummary = buildAiSummary(document);

  return { document, aiSummary };
}

/**
 * 构建 AI 分析摘要
 */
function buildAiSummary(doc: ParsedDocument): FileParseResult["aiSummary"] {
  const primaryTable = doc.tables[0];
  const headers = primaryTable?.headers ?? [];
  const rows = primaryTable?.rows ?? [];
  const maxCols = Math.max(headers.length, ...rows.map((r) => r.length), 0);

  // 表头行预览
  const headerPreview = [
    `检测到 ${headers.length} 列: ${headers.join(" | ")}`,
    `${primaryTable?.headerKVPairs && Object.keys(primaryTable.headerKVPairs).length > 0
      ? `提取头表字段: ${Object.entries(primaryTable.headerKVPairs).map(([k,v]) => `${k}=${v}`).join(", ")}`
      : "未检测到水平布局头表字段"}`,
    ...rows.slice(0, 5).map(
      (r, i) => `第${i + 1}行: ${r.map((c) => String(c?.value ?? "")).join(" | ")}`,
    ),
  ].join("\n");

  // 样例数据
  const sampleRows = rows
    .slice(0, 10)
    .map((r, i) => `行${i + 1}: ${r.map((c) => String(c?.value ?? "")).join(" | ")}`)
    .join("\n");

  return {
    fileName: doc.sourceName,
    fileFormat: doc.sourceFormat,
    sheetNames: doc.tables.map((t) => t.sheetName),
    headerPreview,
    sampleRows,
    totalRows: doc.totalRows,
    totalCols: maxCols,
    textContent: doc.textBlocks?.map((tb) => tb.text).join("\n").slice(0, 3000),
    extractedKVs: primaryTable?.headerKVPairs,
  };
}
