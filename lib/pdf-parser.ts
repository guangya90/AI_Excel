// ============================================================
// PDF 解析器 — pdf-parse 集成提取文本和表格
// ============================================================

import type { ParsedDocument, ParsedTable, TextBlock } from "./rule-types";

/**
 * 解析 PDF 文件
 * 使用 pdf-parse 提取文本 → 构建段落块和可能的表格
 */
export async function parsePdfFile(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();

  // Vercel/浏览器兼容
  if (typeof Buffer === "undefined") {
    throw new Error("PDF 解析需要 Node.js 环境，暂不支持纯浏览器解析。请使用 Excel 或 Word 格式。");
  }
  const buffer = Buffer.from(arrayBuffer);

  // 动态导入 pdf-parse
  let pdfParse: (buf: Buffer) => Promise<{
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }>;
  try {
    const mod = await import(/* webpackIgnore: true */ "pdf-parse");
    pdfParse = mod.default;
  } catch {
    throw new Error("pdf-parse 库未安装，请运行 npm install pdf-parse");
  }

  const data = await pdfParse(buffer);

  if (!data.text || data.text.trim() === "") {
    throw new Error("PDF 文件为空或无法提取文本");
  }

  const pages = data.numpages || 1;
  const lines = data.text.split("\n").filter((l) => l.trim() !== "");

  // 构建文本块（按页分组）
  const textBlocks: TextBlock[] = [];
  let currentPage = 0;
  for (const line of lines) {
    // PDF 文本中常有换页标记
    if (line.includes("\f") || line.includes("===PAGE")) {
      currentPage++;
      continue;
    }
    textBlocks.push({
      text: line.trim(),
      lineIndex: textBlocks.length,
      pageIndex: currentPage,
    });
  }

  // 尝试检测表格
  const tables: ParsedTable[] = [];
  const tableResult = detectTableFromPdfText(lines);
  if (tableResult) {
    tables.push(tableResult);
  }

  // 如果没有检测到表格，创建一个包含所有文本行的单列表
  if (tables.length === 0) {
    tables.push({
      sheetName: `PDF_${pages}页`,
      headers: lines.length > 0 ? ["内容"] : [],
      rows: lines.map((l, i) => [
        { value: l.trim(), row: i, col: 0, colName: "col_0" },
      ]),
    });
  }

  return {
    sourceName: file.name,
    sourceFormat: "pdf",
    tables,
    textBlocks,
    rawContent: data.text.slice(0, 5000),
    totalRows: lines.length,
    warnings: [],
  };
}

/**
 * 从 PDF 文本中检测表格结构
 */
function detectTableFromPdfText(lines: string[]): ParsedTable | null {
  // 寻找连续的空格分隔行（表格特征）
  const tableCandidates: string[][] = [];
  let current: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过明显的标题/分隔行
    if (/^[=+\-━─]{3,}$/.test(trimmed)) {
      if (inTable && current.length > 0) {
        tableCandidates.push(current);
        current = [];
      }
      inTable = false;
      continue;
    }

    // 检测多空格分隔的行 → 可能是表格行
    const parts = trimmed.split(/\s{2,}/).filter(Boolean);
    if (parts.length >= 3) {
      if (inTable) {
        current.push(trimmed);
      } else {
        inTable = true;
        current = [trimmed];
      }
    } else if (inTable && current.length > 0) {
      tableCandidates.push(current);
      current = [];
      inTable = false;
    }
  }

  if (current.length > 0) tableCandidates.push(current);

  // 选取最大的候选表
  if (tableCandidates.length === 0) return null;
  const best = tableCandidates.reduce((a, b) => (a.length > b.length ? a : b));

  if (best.length < 2) return null;

  // 第一行为表头
  const headerParts = best[0].split(/\s{2,}/).filter(Boolean);
  const headers = headerParts;

  const rows = best.slice(1).map((l, i) => {
    const parts = l.split(/\s{2,}/).filter(Boolean);
    return parts.map((v, ci) => ({
      value: v.trim(),
      row: i + 1,
      col: ci,
      colName: `col_${ci}`,
    }));
  });

  return {
    sheetName: "PDF表格",
    headers,
    rows,
  };
}
