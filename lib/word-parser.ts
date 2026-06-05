// ============================================================
// Word 解析器 — mammoth 集成提取文本结构
// ============================================================

import type { ParsedDocument, ParsedTable, TextBlock } from "./rule-types";

/**
 * 解析 Word 文件（.docx）
 * 使用 mammoth.js 提取纯文本 → 构建段落块和可能的表格
 */
export async function parseWordFile(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();

  // 动态导入 mammoth（避免服务端构建问题）
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import(/* webpackIgnore: true */ "mammoth");
  } catch {
    throw new Error("mammoth 库未安装，请运行 npm install mammoth");
  }

  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;

  if (!text || text.trim() === "") {
    throw new Error("Word 文件为空或无法提取文本");
  }

  const lines = text.split("\n").filter((l) => l.trim() !== "");

  // 构建文本块
  const textBlocks: TextBlock[] = lines.map((line, i) => ({
    text: line.trim(),
    lineIndex: i,
  }));

  // 尝试检测表格结构（从文本中识别制表符分隔的行）
  const tableDetected = detectTableFromText(lines);

  const tables: ParsedTable[] = tableDetected
    ? [tableDetected]
    : [
        {
          sheetName: "Word文档",
          headers: lines.length > 0 ? [lines[0]] : [],
          rows: lines.map((l, i) => [
            { value: l.trim(), row: i, col: 0, colName: "col_0" },
          ]),
        },
      ];

  return {
    sourceName: file.name,
    sourceFormat: "docx",
    tables,
    textBlocks,
    rawContent: text.slice(0, 5000),
    totalRows: lines.length,
    warnings: result.messages.map((m) => m.message),
  };
}

/**
 * 从文本行中检测表格结构（制表符分隔）
 */
function detectTableFromText(lines: string[]): ParsedTable | null {
  const tabLines = lines.filter((l) => l.includes("\t"));
  if (tabLines.length < 2) return null;

  // 假设第一行为表头
  const headers = tabLines[0].split("\t").map((h) => h.trim());
  const rows = tabLines.slice(1).map((l, i) =>
    l.split("\t").map((v, ci) => ({
      value: v.trim(),
      row: i + 1,
      col: ci,
      colName: `col_${ci}`,
    })),
  );

  return {
    sheetName: "检测表格",
    headers,
    rows,
  };
}
