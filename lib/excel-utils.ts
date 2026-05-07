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
      sheetScores: Record<string, number>;
    }
  | { ok: false; message: string };

export type SheetAnalysis = {
  name: string;
  matrix: ParsedSheetMatrix;
  hasHeader: boolean;
  score: number;
  detectedTable: DetectedTable | null;
};

/**
 * 分析单个 sheet 是否包含有效的数据表
 * 返回匹配分数：匹配的必填字段数量 * 1000 + 非空单元格数量
 */
function analyzeSheet(sheet: XLSX.WorkSheet): SheetAnalysis {
  const matrix = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as ParsedSheetMatrix;

  if (!matrix.length || matrix.every(row => row.every(cell => !String(cell).trim()))) {
    return { name: "", matrix, hasHeader: false, score: -1, detectedTable: null };
  }

  const detectedTable = detectHeaderAndRows(matrix);
  
  if (!detectedTable) {
    return { name: "", matrix, hasHeader: false, score: 0, detectedTable: null };
  }

  // 计算匹配分数
  const { missingRequired } = autoMapColumns(detectedTable.headers);
  const matchScore = REQUIRED_FIELDS.length - missingRequired.length;
  const nonEmptyCount = detectedTable.headers.filter(Boolean).length;
  const score = matchScore * 1000 + nonEmptyCount;

  return {
    name: "",
    matrix,
    hasHeader: true,
    score,
    detectedTable,
  };
}

export function parseWorkbookBuffer(buf: ArrayBuffer): ParseWorkbookResult {
  try {
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const names = wb.SheetNames.filter(Boolean);
    if (names.length === 0) {
      return { ok: false, message: "文件中没有可用的工作表（Sheet）。" };
    }

    // 如果只有一个 sheet，直接使用
    if (names.length === 1) {
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
      return { ok: true, sheetNames: names, activeSheet: first, matrix, sheetScores: { [first]: 0 } };
    }

    // 多个 sheet，自动检测最匹配的工作表
    let bestSheetName = names[0];
    let bestMatrix: ParsedSheetMatrix = [];
    let bestScore = -1;
    const sheetScores: Record<string, number> = {};

    for (const name of names) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;

      const analysis = analyzeSheet(sheet);
      sheetScores[name] = analysis.score;

      // 选择分数最高的 sheet
      if (analysis.score > bestScore) {
        bestScore = analysis.score;
        bestSheetName = name;
        bestMatrix = analysis.matrix;
      }
    }

    if (bestMatrix.length === 0) {
      return { ok: false, message: "所有工作表均为空，请检查文件内容。" };
    }

    return {
      ok: true,
      sheetNames: names,
      activeSheet: bestSheetName,
      matrix: bestMatrix,
      sheetScores,
    };
  } catch {
    return { ok: false, message: "无法解析该 Excel 文件，格式可能损坏或编码异常。" };
  }
}

const MAX_HEADER_SCAN_ROWS = 10;

export type DetectedTable = {
  headerRowIndex: number;
  headers: string[];
  dataRows: ParsedSheetMatrix;
};

/**
 * 判断是否为合并行或标题行（非数据表头）
 * 合并行通常有以下特征：
 * 1. 完全空行
 * 2. 非空单元格数量很少（如只有1-2个）
 * 3. 非空单元格的值通常是整个表格的标题，而非列名
 * 4. 连续多行可能形成层次结构标题
 */
function isLikelyMergedOrTitleRow(row: (string | number | undefined)[]): boolean {
  const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean);
  const nonEmptyCount = cells.length;
  
  // 完全空行
  if (nonEmptyCount === 0) return true;
  
  // 只有1-3个非空单元格，很可能是合并的标题行
  if (nonEmptyCount <= 3) {
    // 检查是否包含常见的标题关键字
    const combined = cells.join("");
    const titleKeywords = ["订单", "运单", "发货", "收货", "详情", "列表", "汇总", "报表", "导入", "数据", "信息", "记录", "清单", "明细表", "统计表"];
    if (titleKeywords.some(keyword => combined.includes(keyword))) {
      return true;
    }
    // 如果只有一个单元格且内容较长（超过10个字符），也可能是标题
    if (nonEmptyCount === 1 && cells[0].length > 10) {
      return true;
    }
    // 如果只有两个单元格且内容都较长，可能是副标题
    if (nonEmptyCount === 2 && cells.every(cell => cell.length > 5)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Pick header row in first N rows by maximizing synonym matches + non-empty cells.
 * Skips merged rows and empty rows automatically.
 */
export function detectHeaderAndRows(matrix: ParsedSheetMatrix): DetectedTable | null {
  const limit = Math.min(matrix.length, MAX_HEADER_SCAN_ROWS);
  let bestIdx = -1; // 初始化为 -1，表示还没找到任何候选
  let bestScore = -1;

  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    
    // 跳过合并行或标题行
    if (isLikelyMergedOrTitleRow(row)) {
      continue;
    }
    
    const headers = row.map((c) => String(c ?? "").trim());
    const nonEmpty = headers.filter(Boolean);
    
    // 跳过空行（已在 isLikelyMergedOrTitleRow 中处理，但这里再加一层保护）
    if (nonEmpty.length === 0) continue;
    
    // 计算评分：优先匹配必填字段，其次非空单元格数量
    const { missingRequired } = autoMapColumns(headers);
    const matchScore = REQUIRED_FIELDS.length - missingRequired.length;
    const score = matchScore * 1000 + nonEmpty.length;
    
    // 如果没有匹配到任何必填字段，但非空单元格很多，也可能是表头
    if (matchScore === 0 && nonEmpty.length >= 5) {
      // 给一个基础分，避免完全没有匹配时选不到表头
      const fallbackScore = nonEmpty.length;
      if (fallbackScore > bestScore) {
        bestScore = fallbackScore;
        bestIdx = i;
      }
    } else if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // 如果没有找到任何有效的表头行（所有行都被跳过了）
  if (bestIdx === -1) {
    // 尝试从整个矩阵中找第一个非空且非标题的行
    for (let i = 0; i < matrix.length; i++) {
      const row = matrix[i] ?? [];
      const headers = row.map((c) => String(c ?? "").trim());
      const nonEmpty = headers.filter(Boolean);
      if (nonEmpty.length >= 3) { // 至少有3个非空单元格
        bestIdx = i;
        break;
      }
    }
    // 如果还是没找到，返回 null
    if (bestIdx === -1) return null;
  }

  const headerRow = matrix[bestIdx] ?? [];
  const headers = headerRow.map((c) => String(c ?? "").trim());
  
  // 如果最终找到的行还是没有任何非空单元格，返回 null
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
