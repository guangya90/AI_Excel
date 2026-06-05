// ============================================================
// Excel 解析器 — 全表扫描：支持上下/左右混合布局 + 头表尾部识别
// ============================================================

import * as XLSX from "xlsx";
import type { ParsedDocument, ParsedTable, CellValue } from "./rule-types";
import { HEADER_COLUMN_SYNONYMS } from "./column-mapping";

interface ParseOptions {
  maxRows?: number;
  sheetIndex?: number;
}

/**
 * 解析 Excel 文件（.xlsx / .xls）
 */
export async function parseExcelFile(
  file: File,
  options?: ParseOptions,
): Promise<ParsedDocument> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });

  const sheetNames = workbook.SheetNames;
  const warnings: string[] = [];
  const tables: ParsedTable[] = [];

  if (sheetNames.length === 0) {
    throw new Error("Excel 文件中没有可读取的工作表");
  }

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    const rawData = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1, defval: "", blankrows: false,
    });

    if (!rawData || rawData.length === 0) {
      warnings.push(`Sheet "${name}" 为空，已跳过`);
      continue;
    }

    // 构建全量矩阵
    const maxCols = Math.max(...rawData.map((r) => (Array.isArray(r) ? r.length : 0)));
    const maxRows = options?.maxRows ?? rawData.length;
    const effectiveRows = rawData.slice(0, maxRows) as unknown[][];

    const allRows: CellValue[][] = [];
    const rawMatrix: (string | number | undefined)[][] = [];

    for (let r = 0; r < effectiveRows.length; r++) {
      const rawRow = effectiveRows[r];
      if (!Array.isArray(rawRow)) continue;
      const rowCells: CellValue[] = [];
      const matrixRow: (string | number | undefined)[] = [];
      for (let c = 0; c < maxCols; c++) {
        const val = rawRow[c] as string | number | undefined;
        const strVal = val === undefined || val === null ? "" : String(val).trim();
        rowCells.push({ value: val as string | number, row: r, col: c, colName: `col_${c}` });
        matrixRow.push(strVal);
      }
      allRows.push(rowCells);
      rawMatrix.push(matrixRow);
    }

    if (rawMatrix.length === 0) continue;

    // ====== 全表智能扫描 ======
    const scan = fullSheetScan(rawMatrix);

    // 构建 ParsedTable
    tables.push({
      sheetName: name,
      headers: scan.dataHeaders,
      rows: scan.dataRows.map((dataRow, i) =>
        dataRow.map((v, c) => ({
          value: v,
          row: i,
          col: c,
          colName: `col_${c}`,
        })),
      ),
      rawMatrix: scan.dataRows,
      headerKVPairs: scan.headerKVs,
    });

    if (scan.warnings.length > 0) warnings.push(...scan.warnings);
  }

  const totalRows = tables.reduce((sum, t) => sum + t.rows.length, 0);

  return {
    sourceName: file.name,
    sourceFormat: file.name.endsWith(".xls") ? "xls" : "xlsx",
    tables,
    totalRows,
    warnings,
  };
}

// ============================================================
// 全表扫描引擎
// ============================================================

interface SheetScanResult {
  dataHeaders: string[];
  dataRows: (string | number)[][];
  headerKVs: Record<string, string>;
  warnings: string[];
}

function fullSheetScan(matrix: (string | number | undefined)[][]): SheetScanResult {
  const warnings: string[] = [];
  const headerKVs: Record<string, string> = {};

  if (matrix.length === 0) return { dataHeaders: [], dataRows: [], headerKVs, warnings };

  // 1. 检测每一行的类型
  const rowTags = classifyRows(matrix);

  // 2. 从水平布局行中提取键值对（头部和尾部）
  const hRows = rowTags.filter((t) => t.type === "header-kv");
  const fRows = rowTags.filter((t) => t.type === "footer-info");
  for (const hr of [...hRows, ...fRows]) {
    const kvs = extractHorizontalKVPairs(matrix[hr.index]);
    Object.assign(headerKVs, kvs);
  }

  // 4. 同时尝试在尾部简单的 key:value 行
  if (Object.keys(headerKVs).length === 0) {
    const footerKVs = tryExtractFooterKV(matrix);
    Object.assign(headerKVs, footerKVs);
  }

  // 5. 列头行（取第一个 data-header 行，或最佳候选）
  const colHeaderTag = rowTags.find((t) => t.type === "data-header");
  let colHeaderIdx = colHeaderTag?.index ?? 0;
  // 如果 classifyRows 没找到合适的列头（bestHeaderIdx为0且非空），回退到旧逻辑
  if (colHeaderIdx <= 0 && matrix.length > 0) {
    const result = detectHeaderAndRowsLegacy(matrix);
    colHeaderIdx = result.headerRowIndex;
  }
  const dataHeaders = (matrix[colHeaderIdx] || []).map((c) => String(c ?? "").trim());

  // 6. 数据行 = 列头之后的所有非KV非空行
  const dataRows: (string | number)[][] = [];
  for (let i = colHeaderIdx + 1; i < matrix.length; i++) {
    const tag = rowTags.find((t) => t.index === i);
    if (tag && (tag.type === "header-kv" || tag.type === "footer-info" || tag.type === "empty")) continue;
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    if (row.every((c) => String(c ?? "").trim() === "")) continue;
    dataRows.push(row.map((c) => (c === undefined || c === null ? "" : c) as string | number));
  }

  // 7. 将提取到的 KV 映射到系统字段
  const mappedKVs = mapKVsToHeaderFields(headerKVs);
  Object.assign(headerKVs, mappedKVs);

  return { dataHeaders, dataRows, headerKVs: headerKVs, warnings };
}

// ============================================================
// 行分类器（简化版：可靠列头检测）
// ============================================================

type RowTag = { index: number; type: "header-kv" | "data-header" | "data" | "footer-info" | "empty" | "unknown" };

function classifyRows(matrix: (string | number | undefined)[][]): RowTag[] {
  const tags: RowTag[] = [];

  // 简单可靠：找非空单元格最多的行（前15行）
  let bestHeaderIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "").length;
    if (nonEmpty > bestScore) { bestScore = nonEmpty; bestHeaderIdx = i; }
  }

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) { tags.push({ index: i, type: "unknown" }); continue; }
    const values = row.map((c) => String(c ?? "").trim()).filter(Boolean);
    if (values.length === 0) { tags.push({ index: i, type: "empty" }); continue; }

    if (i === bestHeaderIdx) { tags.push({ index: i, type: "data-header" }); continue; }

    // 水平KV检测：头部或尾部
    if (i < bestHeaderIdx || i > matrix.length * 0.5) {
      if (isHorizontalKVPairRow(row)) {
        tags.push({ index: i, type: i > bestHeaderIdx ? "footer-info" : "header-kv" });
        continue;
      }
    }

    tags.push({ index: i, type: i > bestHeaderIdx ? "data" : "unknown" });
  }
  return tags;
}

// ============================================================
// 已知字段关键词库（物流行业标准）
// ============================================================

let _keywords: Set<string> | null = null;
function getKeywords(): Set<string> {
  if (_keywords) return _keywords;
  _keywords = new Set();
  if (HEADER_COLUMN_SYNONYMS) {
    for (const syns of Object.values(HEADER_COLUMN_SYNONYMS)) {
      if (Array.isArray(syns)) for (const s of syns) _keywords!.add(s);
    }
  }
  // 兜底
  if (_keywords.size === 0) {
    ["收货人", "收货电话", "收货地址", "单据号", "门店", "备注"].forEach((k) => _keywords!.add(k));
  }
  return _keywords;
}

function isKnownKeyword(text: string): boolean {
  const t = text.replace(/[【】\[\]]/g, "").trim();
  const keywords = getKeywords();
  if (keywords.has(t)) return true;
  for (const kw of keywords) {
    if (kw.length >= 2 && t.includes(kw)) return true;
  }
  return false;
}

// ============================================================
// 水平键值对检测（基于关键词库）
// ============================================================

function isHorizontalKVPairRow(row: (string | number | undefined)[]): boolean {
  let validPairs = 0;

  for (let c = 0; c < row.length; c++) {
    const v = String(row[c] ?? "").trim();
    if (!v) continue;

    if (isKnownKeyword(v)) {
      // 找下一个非空值
      let nextVal = "";
      for (let nc = c + 1; nc < row.length; nc++) {
        const nv = String(row[nc] ?? "").trim();
        if (nv) { nextVal = nv; c = nc; break; }
      }
      // 有效对：key已知 + value不像另一个key
      if (nextVal && !isKnownKeyword(nextVal)) {
        validPairs++;
      }
    }
  }

  return validPairs >= 2;
}

function extractHorizontalKVPairs(row: (string | number | undefined)[]): Record<string, string> {
  const kvs: Record<string, string> = {};

  for (let c = 0; c < row.length; c++) {
    const key = String(row[c] ?? "").trim();
    if (!key || !isKnownKeyword(key)) continue;

    // 找下一个非空值
    let val = "";
    let valCol = c + 1;
    for (let nc = c + 1; nc < Math.min(c + 3, row.length); nc++) {
      const nv = String(row[nc] ?? "").trim();
      if (nv) { val = nv; valCol = nc; break; }
    }
    if (!val || isKnownKeyword(val)) continue;

    kvs[key] = val;
    c = valCol; // 跳到value位置
  }

  return kvs;
}

// ============================================================
// 尾部键值对检测
// ============================================================

function tryExtractFooterKV(matrix: (string | number | undefined)[][]): Record<string, string> {
  const kvs: Record<string, string> = {};
  const footerStart = Math.max(0, matrix.length - 15);

  for (let i = footerStart; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    const rowText = row.map((c) => String(c ?? "").trim()).filter(Boolean).join(" ");

    // 匹配常见模式：关键词 + 值
    const patterns = [
      /(收货门店|门店名称|收货仓库|仓库|门店)[：:\s]*(\S+)/,
      /(收货人|收件人|联系人|收方)[：:\s]*(\S+)/,
      /(联系电话|电话|手机)[：:\s]*(\d{7,11})/,
      /(收货地址|地址|配送地址)[：:\s]*(.+)/,
      /(配送单号|单号|单据号)[：:\s]*(\S+)/,
      /(备注|说明)[：:\s]*(.+)/,
    ];

    for (const pattern of patterns) {
      const m = rowText.match(pattern);
      if (m) {
        const key = m[1];
        const val = m[2];
        // 根据关键词映射到系统字段
        if (/收货门店|门店名称|收货仓库|仓库/.test(key)) kvs["收货门店"] = val;
        else if (/收货人|收件人|联系人/.test(key)) kvs["收件人姓名"] = val;
        else if (/联系电话|电话|手机/.test(key)) kvs["收件人电话"] = val;
        else if (/收货地址|地址|配送地址/.test(key)) kvs["收件人地址"] = val;
        else if (/配送单号|单号|单据号/.test(key)) kvs["外部编码"] = val;
        else kvs[key] = val;
      }
    }
  }

  return kvs;
}

// ============================================================
// KV到系统字段映射
// ============================================================

function mapKVsToHeaderFields(rawKVs: Record<string, string>): Record<string, string> {
  const mapped: Record<string, string> = {};
  if (!HEADER_COLUMN_SYNONYMS) return mapped;

  // 构建反向索引：别名 → 系统字段
  const reverseMap: Record<string, string> = {};
  for (const [field, synonyms] of Object.entries(HEADER_COLUMN_SYNONYMS)) {
    for (const syn of synonyms) {
      const cleaned = syn.replace(/[【】\[\]（）()_\s：:]/g, "").trim();
      if (cleaned && !reverseMap[cleaned]) reverseMap[cleaned] = field;
    }
  }

  for (const [key, val] of Object.entries(rawKVs)) {
    if (!val || val === "-") continue;
    const t = key.replace(/[【】\[\]（）()_\s：:]/g, "").trim();
    let target = reverseMap[t];
    if (!target) {
      // 子串匹配
      for (const [alias, field] of Object.entries(reverseMap)) {
        if (t.includes(alias) || alias.includes(t)) { target = field; break; }
      }
    }
    if (target && !mapped[target]) mapped[target] = val;
  }
  return mapped;
}

// ============================================================
// 兼容旧接口
// ============================================================

/** 兼容旧接口：使用全表扫描 */
export function detectHeaderAndRows(
  rawMatrix: (string | number | undefined)[][],
): { headerRowIndex: number; headers: string[]; dataRows: (string | number | undefined)[][] } {
  const scan = fullSheetScan(rawMatrix);
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(rawMatrix.length, 15); i++) {
    const row = rawMatrix[i];
    if (!Array.isArray(row)) continue;
    const vals = row.map((c) => String(c ?? "").trim()).filter(Boolean);
    if (vals.length > 0 && vals.every((v) => scan.dataHeaders.includes(v))) {
      headerRowIndex = i;
      break;
    }
  }
  return { headerRowIndex, headers: scan.dataHeaders, dataRows: scan.dataRows };
}

/** 旧版回退：在前10行找非空最多的行作为表头 */
function detectHeaderAndRowsLegacy(
  rawMatrix: (string | number | undefined)[][],
): { headerRowIndex: number; headers: string[] } {
  let bestRow = 0;
  let bestScore = 0;
  const limit = Math.min(10, rawMatrix.length);
  for (let i = 0; i < limit; i++) {
    const row = rawMatrix[i];
    if (!Array.isArray(row)) continue;
    const nonEmpty = row.filter((c) => String(c ?? "").trim() !== "").length;
    if (nonEmpty > bestScore) { bestScore = nonEmpty; bestRow = i; }
  }
  return { headerRowIndex: bestRow, headers: (rawMatrix[bestRow] || []).map((c) => String(c ?? "").trim()) };
}

export function extractMatrixText(
  rawMatrix: (string | number | undefined)[][],
  maxRows: number = 20,
): string {
  return rawMatrix
    .slice(0, maxRows)
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .map((c) => String(c ?? "").trim())
        .join("\t"),
    )
    .join("\n");
}
