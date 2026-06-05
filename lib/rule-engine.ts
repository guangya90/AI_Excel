// ============================================================
// 规则引擎核心 — 头表+明细 双阶段解析调度器
// ============================================================

import type {
  ParsedDocument,
  ParseRuleConfig,
  RuleExecutionOutput,
  HeaderDetailExecutionOutput,
  ParsedTable,
  OrderGroupResult,
} from "./rule-types";
import {
  extractFlatRows,
  groupRowsByHeaderKey,
  applyMatrixTranspose,
  applyCardSplit,
  applyCompositeCellSplit,
  applyTextParse,
  extractFooterFields,
} from "./rule-transforms";

/**
 * 核心入口：根据规则解析文档，输出头表+明细分组
 */
export function executeRule(
  document: ParsedDocument,
  rule: ParseRuleConfig,
): RuleExecutionOutput {
  const hdResult = executeRuleHD(document, rule);
  return {
    success: hdResult.success,
    rows: hdResult.groups.flatMap((g) =>
      g.details.map((d) => ({ ...g.header, ...d })),
    ),
    errors: hdResult.errors,
    warnings: hdResult.warnings,
    stats: {
      totalRows: hdResult.stats.totalRows,
      parsedRows: hdResult.stats.detailsCount,
      skippedRows: hdResult.stats.skippedRows,
      footerExtracted: hdResult.stats.footerExtracted,
    },
  };
}

/**
 * 头表+明细 双阶段解析
 */
export function executeRuleHD(
  document: ParsedDocument,
  rule: ParseRuleConfig,
): HeaderDetailExecutionOutput {
  const warnings: string[] = [];
  const errors: string[] = [];
  let flatRows: Record<string, string>[] = [];
  let totalRows = 0;
  let skippedRows = 0;
  let footerExtracted = false;

  try {
    // 1. 选择目标表格
    let targetTable: ParsedTable | undefined;
    if (rule.region.mergeSheets && document.tables.length > 0) {
      targetTable = mergeTables(document.tables);
      warnings.push(`合并了 ${document.tables.length} 个Sheet`);
    } else if (rule.region.sheetFilter) {
      targetTable = document.tables.find((t) => t.sheetName === rule.region.sheetFilter);
      if (!targetTable) {
        warnings.push(`未找到 Sheet "${rule.region.sheetFilter}"，使用第一个Sheet`);
        targetTable = document.tables[0];
      }
    } else {
      targetTable = document.tables[0];
    }

    if (!targetTable || targetTable.rows.length === 0) {
      if (rule.transform.type === "text_parse" && document.textBlocks) {
        flatRows = applyTextParse(document.textBlocks, rule.transform.config);
        totalRows = flatRows.length;
      } else {
        errors.push("未找到可解析的数据区域");
        return emptyHDResult(errors, warnings);
      }
    } else {
      totalRows = targetTable.rows.length;

      // 2. 合并头表+明细列映射
      const allColumns = { ...rule.headerColumns, ...rule.detailColumns };

      // 3. 根据变换类型提取扁平行数据
      switch (rule.transform.type) {
        case "none":
          flatRows = extractFlatRows(targetTable, allColumns, rule.defaults, rule.region);
          break;
        case "matrix_transpose":
          flatRows = applyMatrixTranspose(targetTable, allColumns, rule.transform.config, rule.defaults, rule.region);
          break;
        case "card_split":
          flatRows = applyCardSplit(targetTable, allColumns, rule.transform.config, rule.defaults, rule.region);
          break;
        case "composite_cell_split":
          flatRows = applyCompositeCellSplit(targetTable, allColumns, rule.transform.config, rule.defaults, rule.region);
          break;
        case "text_parse":
          flatRows = applyTextParse(document.textBlocks || [], rule.transform.config);
          break;
        default:
          warnings.push(`未知变换类型 "${rule.transform.type}"，使用标准映射`);
          flatRows = extractFlatRows(targetTable, allColumns, rule.defaults, rule.region);
      }

      // 4. 提取尾部信息
      if (rule.footer && rule.footer.length > 0) {
        const footerResult = extractFooterFields(targetTable, rule.footer, rule.region);
        if (footerResult.extracted) {
          flatRows = flatRows.map((row) => ({ ...footerResult.fields, ...row }));
          footerExtracted = true;
        }
      }
    }

    // 5. 应用默认值
    if (rule.defaults) {
      flatRows = flatRows.map((row) => ({ ...rule.defaults, ...row }));
    }

    // 6. 按头表分组键归组
    const groupKey = rule.headerGroupBy || "externalCode";
    const groups = groupRowsByHeaderKey(flatRows, groupKey, rule.headerColumns, rule.detailColumns);

    // 7. 注入全表扫描提取的头表KV（左右结构/尾部提取的键值对）
    if (targetTable?.headerKVPairs && Object.keys(targetTable.headerKVPairs).length > 0) {
      for (const g of groups) {
        for (const [field, val] of Object.entries(targetTable.headerKVPairs)) {
          if (val && !g.header[field]) {
            g.header[field] = val;
          }
        }
      }
    }

    const ambiguousRowCount = 0;

    skippedRows = totalRows - flatRows.length;

    return {
      success: errors.length === 0,
      groups,
      errors,
      warnings,
      stats: {
        totalRows,
        groupsCount: groups.length,
        detailsCount: groups.reduce((sum, g) => sum + g.details.length, 0),
        skippedRows,
        footerExtracted,
        ambiguousRowCount,
      },
    };
  } catch (e) {
    errors.push(`规则执行异常: ${e instanceof Error ? e.message : String(e)}`);
    return emptyHDResult(errors, warnings);
  }
}

function emptyHDResult(errors: string[], warnings: string[]): HeaderDetailExecutionOutput {
  return {
    success: false, groups: [], errors, warnings,
    stats: { totalRows: 0, groupsCount: 0, detailsCount: 0, skippedRows: 0, footerExtracted: false, ambiguousRowCount: 0 },
  };
}

function mergeTables(tables: ParsedTable[]): ParsedTable {
  const allHeaders = tables[0]?.headers || [];
  const allRows = tables.flatMap((t) => t.rows);
  return { sheetName: `merged_${tables.length}sheets`, headers: allHeaders, rows: allRows };
}
