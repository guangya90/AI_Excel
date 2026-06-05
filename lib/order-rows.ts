import type { OrderFieldKey, OrderRowDraft, HeaderDraft, DetailDraft, OrderGroup } from "./order-types";
import { HEADER_EN_KEYS, DETAIL_EN_KEYS, FIELD_LABELS, ORDER_FIELD_KEYS, REQUIRED_DETAIL_FIELDS, ERR_NO_CONTACT, ERR_NO_ADDRESS } from "./order-types";

export type ParsedRowError = { row: number; field: OrderFieldKey; message: string; groupId?: string };

export type BatchValidation = {
  rowFieldErrors: Map<string, string>;
  list: ParsedRowError[];
  duplicateExternalRows: Map<string, number[]>;
};

function keyRF(row: number, field: string): string {
  return `${row}\u0000${field}`;
}

export function validateGroups(groups: OrderGroup[]): BatchValidation {
  const rowFieldErrors = new Map<string, string>();
  const list: ParsedRowError[] = [];
  const codeToRows = new Map<string, number[]>();

  groups.forEach((group, gi) => {
    const displayGroup = gi + 1;
    const h = group.header;

    const hasName = (h.receiverName || "").trim();
    const hasPhone = (h.receiverPhone || "").trim();
    const hasStore = (h.receiverStore || "").trim();
    const hasAddr = (h.receiverAddress || "").trim();

    if (!hasName && !hasPhone) {
      const k = keyRF(displayGroup, "receiverName");
      rowFieldErrors.set(k, ERR_NO_CONTACT);
      list.push({ row: displayGroup, field: "receiverName", message: `第${displayGroup}组，${ERR_NO_CONTACT}`, groupId: group.id });
    }
    if (!hasStore && !hasAddr) {
      const k = keyRF(displayGroup, "receiverStore");
      rowFieldErrors.set(k, ERR_NO_ADDRESS);
      list.push({ row: displayGroup, field: "receiverStore", message: `第${displayGroup}组，${ERR_NO_ADDRESS}`, groupId: group.id });
    }

    const code = (h.externalCode || "").trim();
    if (code) {
      const arr = codeToRows.get(code.toLowerCase()) ?? [];
      arr.push(displayGroup);
      codeToRows.set(code.toLowerCase(), arr);
    }

    group.details.forEach((detail, di) => {
      const displayRow = displayGroup * 1000 + di + 1;
      const missing = REQUIRED_DETAIL_FIELDS.filter((f) => !detail[f] || String(detail[f]).trim() === "");
      missing.forEach((field) => {
        const k = keyRF(displayRow, field);
        if (!rowFieldErrors.has(k)) {
          const msg = `${FIELD_LABELS[field]}：缺失必填`;
          rowFieldErrors.set(k, msg);
          list.push({ row: displayRow, field, message: `第${displayGroup}组-明细${di + 1}，${msg}`, groupId: group.id });
        }
      });
      if (group.details.length === 0) {
        const k = keyRF(displayGroup, "skuCode");
        const msg = `第${displayGroup}组：至少需要一条明细`;
        rowFieldErrors.set(k, msg);
        list.push({ row: displayGroup, field: "skuCode", message: msg, groupId: group.id });
      }
    });
  });

  const duplicateExternalRows = new Map<string, number[]>();
  for (const [, rowNums] of codeToRows) {
    if (rowNums.length > 1) {
      const sorted = [...rowNums].sort((a, b) => a - b);
      duplicateExternalRows.set(sorted.join(","), sorted);
      const msg = `同批次外部编码重复（第 ${sorted.join("、")} 组）`;
      for (const r of sorted) {
        const k = keyRF(r, "externalCode");
        rowFieldErrors.set(k, msg);
        list.push({ row: r, field: "externalCode", message: `第${r}组，${msg}` });
      }
    }
  }
  return { rowFieldErrors, list, duplicateExternalRows };
}

export function validateBatchRows(rows: OrderRowDraft[]): BatchValidation {
  const rowFieldErrors = new Map<string, string>();
  const list: ParsedRowError[] = [];
  const codeToRows = new Map<string, number[]>();

  rows.forEach((draft, i) => {
    const displayRow = i + 1;
    const code = (draft.externalCode || "").trim();
    if (code) { const arr = codeToRows.get(code.toLowerCase()) ?? []; arr.push(displayRow); codeToRows.set(code.toLowerCase(), arr); }

    REQUIRED_DETAIL_FIELDS.forEach((field) => {
      if (!draft[field] || String(draft[field]).trim() === "") {
        const k = keyRF(displayRow, field);
        if (!rowFieldErrors.has(k)) {
          const msg = `${FIELD_LABELS[field]}：缺失必填`;
          rowFieldErrors.set(k, msg);
          list.push({ row: displayRow, field, message: `第${displayRow}行，${msg}` });
        }
      }
    });
  });

  const duplicateExternalRows = new Map<string, number[]>();
  for (const [, rowNums] of codeToRows) {
    if (rowNums.length > 1) {
      const sorted = [...rowNums].sort((a, b) => a - b);
      duplicateExternalRows.set(sorted.join(","), sorted);
      for (const r of sorted) {
        const k = keyRF(r, "externalCode");
        const msg = `同批次外部编码重复（第 ${sorted.join("、")} 行）`;
        rowFieldErrors.set(k, msg);
        list.push({ row: r, field: "externalCode", message: `第${r}行，${msg}` });
      }
    }
  }
  return { rowFieldErrors, list, duplicateExternalRows };
}

export function mergeDbExternalDuplicateMessages(base: BatchValidation, dbDuplicateRows: Map<string, number[]>): BatchValidation {
  const rowFieldErrors = new Map(base.rowFieldErrors);
  const list = [...base.list];
  for (const [, rows] of dbDuplicateRows) {
    const sorted = [...rows].sort((a, b) => a - b);
    const msg = `外部编码与已有运单重复（第 ${sorted.join("、")} 行）`;
    for (const r of sorted) {
      const k = keyRF(r, "externalCode");
      rowFieldErrors.set(k, msg);
      list.push({ row: r, field: "externalCode", message: `第${r}行，${msg}` });
    }
  }
  return { rowFieldErrors, list, duplicateExternalRows: base.duplicateExternalRows };
}
