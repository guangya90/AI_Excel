import type { HeaderFieldKey, DetailFieldKey, OrderFieldKey } from "./order-types";
import { HEADER_EN_KEYS, DETAIL_EN_KEYS, HEADER_CN, DETAIL_CN, ORDER_FIELD_KEYS, REQUIRED_DETAIL_FIELDS } from "./order-types";

export { HEADER_EN_KEYS as HEADER_FIELD_KEYS, DETAIL_EN_KEYS as DETAIL_FIELD_KEYS };

// ============================================================
// 同义词表（原始方案，中文匹配稳定）
// ============================================================

export const HEADER_COLUMN_SYNONYMS: Record<HeaderFieldKey, string[]> = {
  externalCode: [
    "外部编码", "外部单号", "客户单号", "订单号", "配送单号", "运单号", "单号", "调拨单号",
    "发货单号", "出库单号", "单据号", "单据编号", "流水号", "编号", "单据号编码",
  ],
  receiverStore: [
    "收货门店", "门店名称", "门店名", "门店", "收货机构", "店铺名称", "店铺", "机构名称",
    "机构", "餐厅名称", "餐厅", "store", "收货仓库", "仓库", "供货机构", "送货机构",
  ],
  receiverName: [
    "收件人姓名", "收件人", "收货人", "收方", "收货人姓名", "联系人", "客户姓名", "签收人",
  ],
  receiverPhone: [
    "收件人电话", "收货人电话", "收方电话", "联系电话", "手机号", "电话", "联系方式", "手机",
    "收货电话", "收件电话", "收货人手机号",
  ],
  receiverAddress: [
    "收件人地址", "收货地址", "送达地址", "收件地址", "详细地址", "地址", "配送地址", "送货地址",
    "收货地点", "收货位置",
  ],
  remark: [
    "备注", "说明", "留言", "remark", "note", "memo", "附注", "注释", "补充",
  ],
};

export const DETAIL_COLUMN_SYNONYMS: Record<DetailFieldKey, string[]> = {
  skuCode: [
    "SKU物品编码", "SKU编码", "物品编码", "SKU", "商品编码", "货号", "产品编码", "商品编号",
    "品类编码", "物品编号", "编码", "物料编码", "物料号", "货品编码", "产品编号", "存货编码",
  ],
  skuName: [
    "SKU物品名称", "SKU名称", "物品名称", "商品名称", "产品名称", "名称", "货物名称", "产品名",
    "品名", "商品名", "物料名称", "货品名称", "品类名称", "存货名称",
  ],
  skuQty: [
    "SKU发货数量", "发货数量", "数量", "件数", "配送数量", "出库数量", "调拨数量", "订货数量",
    "订购数量", "需求数量", "计划数量", "箱数", "个数", "发货数", "实发数量",
  ],
  skuSpec: [
    "SKU规格型号", "规格型号", "规格", "型号", "产品规格", "商品规格", "物品规格", "SKU规格",
    "包装规格", "计量单位", "单位", "包装", "规格/型号",
  ],
};

// 兼容
export const COLUMN_SYNONYMS: Record<OrderFieldKey, string[]> = {
  ...HEADER_COLUMN_SYNONYMS,
  ...DETAIL_COLUMN_SYNONYMS,
};

// ============================================================
// 匹配算法（原始LCS + 中文子串，阈值30）
// ============================================================

export function normalizeHeader(cell: unknown): string {
  return String(cell ?? "").trim();
}

function stripNoise(s: string): string {
  return s.replace(/[\s_:：\-\(\)（）\/\\kgKG㎡³\u0000-\u001f]/g, "");
}

function longestCommonSubstring(a: string, b: string): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j <= a.length; j++) {
      if (b.includes(a.slice(i, j))) max = Math.max(max, j - i);
    }
  }
  return max;
}

function matchScore(header: string, synonyms: string[]): number {
  const h = normalizeHeader(header);
  if (!h) return 0;
  let best = 0;
  for (const syn of synonyms) {
    const s = syn.trim();
    if (!s) continue;
    const hl = h.toLowerCase();
    const sl = s.toLowerCase();

    if (hl === sl) return 100;
    const hClean = stripNoise(hl);
    const sClean = stripNoise(sl);
    if (hClean === sClean) return 98;
    if (hClean.length > 1 && sClean.length > 1 && (hClean.includes(sClean) || sClean.includes(hClean))) {
      best = Math.max(best, 88);
    }
    const matchLen = longestCommonSubstring(hl, sl);
    const ratio = matchLen / Math.max(hl.length, sl.length);
    if (ratio >= 0.8) best = Math.max(best, 85);
    else if (ratio >= 0.6) best = Math.max(best, 70);
    else if (ratio >= 0.4) best = Math.max(best, 50);
    else if (ratio >= 0.25) best = Math.max(best, 35);
    // 英文数字子串
    if (/[a-zA-Z]/.test(hl) && /[a-zA-Z]/.test(sl) && (hl.includes(sl) || sl.includes(hl))) {
      best = Math.max(best, 75);
    }
  }
  // 中文兜底
  if (best < 35 && /^[\u4e00-\u9fff]/.test(header)) {
    for (const syn of synonyms) {
      const sClean = stripNoise(syn);
      const share = [...header].filter((ch) => sClean.includes(ch)).length;
      if (share / Math.max(header.length, sClean.length) >= 0.5) best = Math.max(best, 40);
      else if (share / Math.max(header.length, sClean.length) >= 0.33) best = Math.max(best, 30);
    }
  }
  return best;
}

export function matchFieldForHeader(header: string, field: OrderFieldKey): number {
  const syns = COLUMN_SYNONYMS[field];
  if (!syns) return 0;
  return matchScore(header, syns);
}

// ============================================================
// 分析结果
// ============================================================

export interface ColumnAnalysis {
  headerMapping: Partial<Record<string, { col: string; score: number }>>;
  detailMapping: Partial<Record<string, { col: string; score: number }>>;
  unmatched: string[];
  missingRequired: string[];
}

export function analyzeColumns(rawHeaders: string[]): ColumnAnalysis {
  const headerMapping: ColumnAnalysis["headerMapping"] = {};
  const detailMapping: ColumnAnalysis["detailMapping"] = {};
  const used = new Set<string>();

  // 扫描所有候选
  const candidates: Array<{ field: string; col: string; type: "header" | "detail"; score: number }> = [];
  for (const field of DETAIL_EN_KEYS) {
    for (const col of rawHeaders) {
      candidates.push({ field, col, type: "detail", score: matchScore(col, DETAIL_COLUMN_SYNONYMS[field]) });
    }
  }
  for (const field of HEADER_EN_KEYS) {
    for (const col of rawHeaders) {
      candidates.push({ field, col, type: "header", score: matchScore(col, HEADER_COLUMN_SYNONYMS[field]) });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // 贪心分配（阈值30）
  for (const c of candidates) {
    if (c.score < 30) continue;
    if (used.has(c.col)) continue;
    if (c.type === "detail" && !detailMapping[c.field]) {
      detailMapping[c.field] = { col: c.col, score: c.score };
      used.add(c.col);
    } else if (c.type === "header" && !headerMapping[c.field]) {
      headerMapping[c.field] = { col: c.col, score: c.score };
      used.add(c.col);
    }
  }

  const unmatched = rawHeaders.filter((c) => !used.has(c));
  const missingRequired = REQUIRED_DETAIL_FIELDS.filter((f) => !detailMapping[f]);

  return { headerMapping, detailMapping, unmatched, missingRequired };
}

export function autoMapColumns(rawHeaders: string[]): {
  headerMapping: Partial<Record<string, string>>;
  detailMapping: Partial<Record<string, string>>;
  columnAnalysis: ColumnAnalysis;
  missingRequired: string[];
} {
  const analysis = analyzeColumns(rawHeaders);
  return {
    headerMapping: Object.fromEntries(
      Object.entries(analysis.headerMapping).filter(([, v]) => v != null).map(([k, v]) => [k, v!.col]),
    ),
    detailMapping: Object.fromEntries(
      Object.entries(analysis.detailMapping).filter(([, v]) => v != null).map(([k, v]) => [k, v!.col]),
    ),
    columnAnalysis: analysis,
    missingRequired: analysis.missingRequired,
  };
}

// 兼容
export type AutoMapResult = { mapping: Partial<Record<string, string>>; confidence: Record<string, number>; missingRequired: string[] };
export function autoMapColumnsLegacy(rawHeaders: string[]): AutoMapResult {
  const { headerMapping, detailMapping, missingRequired } = autoMapColumns(rawHeaders);
  return { mapping: { ...headerMapping, ...detailMapping }, confidence: {}, missingRequired };
}
export function isCompleteMapping(m: Partial<Record<string, string>>): boolean {
  return REQUIRED_DETAIL_FIELDS.every((f) => Boolean(m[f]?.trim()));
}
