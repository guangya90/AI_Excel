import type { OrderFieldKey } from "./order-types";
import { ORDER_FIELD_KEYS, REQUIRED_FIELDS } from "./order-types";

/** Synonyms per field — normalized matching (lowercase, trim) */
export const COLUMN_SYNONYMS: Record<OrderFieldKey, string[]> = {
  externalCode: [
    "外部编码",
    "外部单号",
    "客户单号",
    "订单号",
    "reference",
    "ref",
    "ext",
    "external",
    "externalcode",
    "external code",
    "waybill no",
  ],
  senderName: [
    "发件人姓名",
    "发件人",
    "寄件人",
    "寄件人姓名",
    "sender",
    "sender name",
    "shipper",
    "发货人",
  ],
  senderPhone: [
    "发件人电话",
    "寄件人电话",
    "发件电话",
    "sender phone",
    "sender tel",
    "shipper phone",
  ],
  senderAddress: [
    "发件人地址",
    "寄件地址",
    "发件地址",
    "sender address",
    "ship from",
    "发货地址",
  ],
  receiverName: [
    "收件人姓名",
    "收件人",
    "收货人",
    "收方",
    "receiver",
    "receiver name",
    "consignee",
    "收货人姓名",
  ],
  receiverPhone: [
    "收件人电话",
    "收货人电话",
    "收方电话",
    "receiver phone",
    "receiver tel",
    "consignee phone",
    "联系电话",
  ],
  receiverAddress: [
    "收件人地址",
    "收货地址",
    "收方地址",
    "receiver address",
    "delivery address",
    "详细地址",
  ],
  weightKg: ["重量(kg)", "重量kg", "重量", "weight", "weight kg", "毛重", "总重"],
  pieceCount: ["件数", "数量", "包裹数", "pieces", "qty", "quantity", "箱数"],
  tempZone: ["温层", "温度类型", "运输温区", "temp", "temperature zone", "冷链类型"],
  remark: ["备注", "说明", "留言", "remark", "note", "notes", "memo"],
};

export function normalizeHeader(cell: unknown): string {
  return String(cell ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .toLowerCase();
}

function stripNoise(s: string): string {
  return s.replace(/[\s_:：\-\(\)（）kgKG]/g, "");
}

/**
 * Score how well a header matches a field (higher = better).
 */
export function matchFieldForHeader(header: string, field: OrderFieldKey): number {
  const n = normalizeHeader(header);
  if (!n) return 0;
  const stripped = stripNoise(n);
  const syns = COLUMN_SYNONYMS[field];
  let best = 0;
  for (const syn of syns) {
    const sn = normalizeHeader(syn);
    const ss = stripNoise(sn);
    if (n === sn || stripped === ss) return 100;
    if (n.includes(sn) || sn.includes(n)) best = Math.max(best, 80);
    else if (stripped.includes(ss) || ss.includes(stripped)) best = Math.max(best, 70);
  }
  return best;
}

export type AutoMapResult = {
  mapping: Partial<Record<OrderFieldKey, string>>;
  /** Excel header text per field (original column name) */
  confidence: Record<string, number>;
  missingRequired: OrderFieldKey[];
};

export function autoMapColumns(excelHeaders: string[]): AutoMapResult {
  const mapping: Partial<Record<OrderFieldKey, string>> = {};
  const confidence: Record<string, number> = {};
  const used = new Set<string>();

  for (const field of ORDER_FIELD_KEYS) {
    let bestCol: string | undefined;
    let bestScore = 0;
    for (const col of excelHeaders) {
      if (used.has(col)) continue;
      const s = matchFieldForHeader(col, field);
      if (s > bestScore) {
        bestScore = s;
        bestCol = col;
      }
    }
    if (bestCol && bestScore >= 70) {
      mapping[field] = bestCol;
      used.add(bestCol);
      confidence[field] = bestScore;
    }
  }

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  return { mapping, confidence, missingRequired };
}

export function isCompleteMapping(m: Partial<Record<OrderFieldKey, string>>): boolean {
  return REQUIRED_FIELDS.every((f) => Boolean(m[f]?.trim()));
}
