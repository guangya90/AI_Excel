import * as XLSX from "xlsx";
import type { OrderFieldKey, OrderRowDraft } from "./order-types";
import { FIELD_LABELS, ORDER_FIELD_KEYS, REQUIRED_FIELDS } from "./order-types";
import { autoMapColumns, normalizeHeader } from "./column-mapping";

export const MAX_FILE_BYTES = 1024 * 1024; // 1MB

export type ParsedSheetMatrix = (string | number | undefined)[][];

export type ParseWorkbookResult =
  | {
      ok: true;
      sheetNames: string[];
      activeSheet: string;
      matrix: ParsedSheetMatrix;
    }
  | { ok: false; message: string };

export function parseWorkbookBuffer(buf: ArrayBuffer): ParseWorkbookResult {
  try {
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const names = wb.SheetNames.filter(Boolean);
    if (names.length === 0) {
      return { ok: false, message: "文件中没有可用的工作表（Sheet）。" };
    }
    const first = names[0];
    const sheet = wb.Sheets[first];
    if (!sheet) {
      return { ok: false, message: "无法读取默认工作表。" };
    }
    const matrix = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as ParsedSheetMatrix;
    if (!matrix.length) {
      return { ok: false, message: "工作表为空，请检查文件内容。" };
    }
    return { ok: true, sheetNames: names, activeSheet: first, matrix };
  } catch {
    return { ok: false, message: "无法解析该 Excel 文件，格式可能损坏或编码异常。" };
  }
}

const MAX_HEADER_SCAN_ROWS = 6;

export type DetectedTable = {
  headerRowIndex: number;
  headers: string[];
  dataRows: ParsedSheetMatrix;
};

/**
 * Pick header row in first N rows by maximizing synonym matches + non-empty cells.
 */
export function detectHeaderAndRows(matrix: ParsedSheetMatrix): DetectedTable | null {
  const limit = Math.min(matrix.length, MAX_HEADER_SCAN_ROWS);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    const headers = row.map((c) => String(c ?? "").trim());
    const nonEmpty = headers.filter(Boolean);
    if (nonEmpty.length === 0) continue;
    const { missingRequired } = autoMapColumns(headers);
    const matchScore = REQUIRED_FIELDS.length - missingRequired.length;
    const score = matchScore * 1000 + nonEmpty.length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  const headerRow = matrix[bestIdx] ?? [];
  const headers = headerRow.map((c) => String(c ?? "").trim());
  if (!headers.some(Boolean)) return null;

  const dataRows = matrix.slice(bestIdx + 1);
  return { headerRowIndex: bestIdx, headers, dataRows };
}

export function exportDraftRowsToXlsx(rows: OrderRowDraft[], fileName: string): void {
  const header = ORDER_FIELD_KEYS.map((k) => FIELD_LABELS[k]);
  const body = rows.map((r) => ORDER_FIELD_KEYS.map((k) => r[k] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "导入数据");
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
