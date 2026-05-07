import type { OrderFieldKey, OrderRowDraft } from "./order-types";
import { FIELD_LABELS, ORDER_FIELD_KEYS, orderRowSchema } from "./order-types";
import type { ParsedSheetMatrix } from "./excel-utils";

export function matrixRowToDraft(
  row: (string | number | undefined)[],
  headers: string[],
  mapping: Partial<Record<OrderFieldKey, string>>,
): OrderRowDraft {
  const draft: OrderRowDraft = {
    externalCode: "",
    senderName: "",
    senderPhone: "",
    senderAddress: "",
    receiverName: "",
    receiverPhone: "",
    receiverAddress: "",
    weightKg: "",
    pieceCount: "",
    tempZone: "",
    remark: "",
  };

  const headerToIndex = new Map<string, number>();
  headers.forEach((h, i) => {
    if (!headerToIndex.has(h)) headerToIndex.set(h, i);
  });

  for (const key of ORDER_FIELD_KEYS) {
    const colName = mapping[key];
    if (!colName) continue;
    const idx = headerToIndex.get(colName);
    if (idx === undefined) continue;
    const raw = row[idx];
    draft[key] = raw === undefined || raw === null ? "" : String(raw).trim();
  }

  return draft;
}

export function buildDraftRowsFromMatrix(
  dataRows: ParsedSheetMatrix,
  headers: string[],
  mapping: Partial<Record<OrderFieldKey, string>>,
): OrderRowDraft[] {
  const out: OrderRowDraft[] = [];
  for (const row of dataRows) {
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue;
    out.push(matrixRowToDraft(row, headers, mapping));
  }
  return out;
}

export type ParsedRowError = {
  /** 1-based display row in preview grid */
  row: number;
  field: OrderFieldKey;
  message: string;
};

export type BatchValidation = {
  rowFieldErrors: Map<string, string>;
  list: ParsedRowError[];
  duplicateExternalRows: Map<string, number[]>;
};

function keyRF(row: number, field: OrderFieldKey): string {
  return `${row}\u0000${field}`;
}

/**
 * Zod validate each row; collect duplicate external codes within batch (by normalized code).
 */
export function validateBatchRows(rows: OrderRowDraft[]): BatchValidation {
  const rowFieldErrors = new Map<string, string>();
  const list: ParsedRowError[] = [];
  const codeToRows = new Map<string, number[]>();

  rows.forEach((draft, i) => {
    const displayRow = i + 1;
    const code = draft.externalCode.trim();
    if (code) {
      const norm = code.toLowerCase();
      const arr = codeToRows.get(norm) ?? [];
      arr.push(displayRow);
      codeToRows.set(norm, arr);
    }

    const parsed = orderRowSchema.safeParse({
      ...draft,
      senderPhone: draft.senderPhone.replace(/\s/g, ""),
      receiverPhone: draft.receiverPhone.replace(/\s/g, ""),
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string" && ORDER_FIELD_KEYS.includes(path as OrderFieldKey)) {
          const field = path as OrderFieldKey;
          const k = keyRF(displayRow, field);
          if (!rowFieldErrors.has(k)) {
            const msg = `${FIELD_LABELS[field]}：${issue.message}`;
            rowFieldErrors.set(k, msg);
            list.push({ row: displayRow, field, message: `第${displayRow}行，${msg}` });
          }
        }
      }
    }
  });

  const duplicateExternalRows = new Map<string, number[]>();
  for (const [, rowNums] of codeToRows) {
    if (rowNums.length > 1) {
      const sorted = [...rowNums].sort((a, b) => a - b);
      const key = sorted.join(",");
      duplicateExternalRows.set(key, sorted);
      const msg = `同批次外部编码重复（第 ${sorted.join("、")} 行）`;
      for (const r of sorted) {
        const k = keyRF(r, "externalCode");
        rowFieldErrors.set(k, msg);
        list.push({ row: r, field: "externalCode", message: `第${r}行，${FIELD_LABELS.externalCode}：${msg}` });
      }
    }
  }

  return { rowFieldErrors, list, duplicateExternalRows };
}

export function mergeDbExternalDuplicateMessages(
  base: BatchValidation,
  dbDuplicateRows: Map<string, number[]>,
): BatchValidation {
  const rowFieldErrors = new Map(base.rowFieldErrors);
  const list = [...base.list];

  for (const [, rows] of dbDuplicateRows) {
    const sorted = [...rows].sort((a, b) => a - b);
    const msg = `外部编码与已有运单重复（第 ${sorted.join("、")} 行）`;
    for (const r of sorted) {
      const k = keyRF(r, "externalCode");
      rowFieldErrors.set(k, msg);
      list.push({
        row: r,
        field: "externalCode",
        message: `第${r}行，${FIELD_LABELS.externalCode}：${msg}`,
      });
    }
  }

  return {
    rowFieldErrors,
    list,
    duplicateExternalRows: base.duplicateExternalRows,
  };
}
