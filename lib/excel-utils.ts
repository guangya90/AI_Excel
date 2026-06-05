import * as XLSX from "xlsx";
import type { OrderRowDraft, OrderGroup } from "./order-types";
import { FIELD_LABELS, ORDER_FIELD_KEYS, HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS } from "./order-types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ============================================================
// 导出
// ============================================================

/** 导出扁平行（兼容旧版） */
export function exportDraftRowsToXlsx(rows: OrderRowDraft[], fileName: string): void {
  const header = ORDER_FIELD_KEYS.map((k) => FIELD_LABELS[k]);
  const body = rows.map((r) => ORDER_FIELD_KEYS.map((k) => r[k] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "导入数据");
  XLSX.writeFile(wb, fileName);
}

/** 导出头表+明细格式 */
export function exportGroupsToXlsx(groups: OrderGroup[], fileName: string): void {
  // 构建双行表头
  const headerLabels = HEADER_FIELD_KEYS.map((k) => FIELD_LABELS[k]).concat(DETAIL_FIELD_KEYS.map((k) => FIELD_LABELS[k]));

  let rows: string[][] = [];
  for (const group of groups) {
    for (const detail of group.details) {
      const hvals = HEADER_FIELD_KEYS.map((k) => group.header[k] ?? "");
      const dvals = DETAIL_FIELD_KEYS.map((k) => detail[k] ?? "");
      rows.push([...hvals, ...dvals]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([headerLabels, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "订单数据");
  XLSX.writeFile(wb, fileName);
}
