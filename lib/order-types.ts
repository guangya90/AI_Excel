import { z } from "zod";

// ============================================================
// 内部key（英文，引擎使用）
// ============================================================

export const HEADER_EN_KEYS = [
  "externalCode",
  "receiverStore",
  "receiverName",
  "receiverPhone",
  "receiverAddress",
  "remark",
] as const;

export const DETAIL_EN_KEYS = [
  "skuCode",
  "skuName",
  "skuQty",
  "skuSpec",
] as const;

export type HeaderFieldKey = (typeof HEADER_EN_KEYS)[number];
export type DetailFieldKey = (typeof DETAIL_EN_KEYS)[number];
export type OrderFieldKey = HeaderFieldKey | DetailFieldKey;

// ============================================================
// 中文标签
// ============================================================

export const HEADER_CN: Record<HeaderFieldKey, string> = {
  externalCode: "外部编码",
  receiverStore: "收货门店",
  receiverName: "收件人姓名",
  receiverPhone: "收件人电话",
  receiverAddress: "收件人地址",
  remark: "备注",
};

export const DETAIL_CN: Record<DetailFieldKey, string> = {
  skuCode: "SKU物品编码",
  skuName: "SKU物品名称",
  skuQty: "SKU发货数量",
  skuSpec: "SKU规格型号",
};

/** 兼容旧的 ORDER_FIELD_KEYS */
export const ORDER_FIELD_KEYS = [...HEADER_EN_KEYS, ...DETAIL_EN_KEYS] as const;

/** 兼容旧的 FIELD_LABELS */
export const FIELD_LABELS: Record<OrderFieldKey, string> = { ...HEADER_CN, ...DETAIL_CN };

/** 兼容旧的 HEADER_FIELD_KEYS / DETAIL_FIELD_KEYS */
export const HEADER_FIELD_KEYS = HEADER_EN_KEYS;
export const DETAIL_FIELD_KEYS = DETAIL_EN_KEYS;

// ============================================================
// 别名映射（源列名→内部英文key）
// ============================================================

export const HEADER_ALIAS_MAP: Record<string, HeaderFieldKey> = {};
export const DETAIL_ALIAS_MAP: Record<string, DetailFieldKey> = {};

// 构建别名映射
const headerAliases: Record<string, HeaderFieldKey> = {
  "外部编码": "externalCode", "订单号": "externalCode", "单据编号": "externalCode",
  "单据号": "externalCode", "配送单号": "externalCode", "运单号": "externalCode",
  "单号": "externalCode", "调拨单号": "externalCode", "发货单号": "externalCode",

  "收货门店": "receiverStore", "门店名称": "receiverStore", "门店": "receiverStore",
  "收货机构": "receiverStore", "店铺名称": "receiverStore", "餐厅名称": "receiverStore",
  "供货机构": "receiverStore", "仓库": "receiverStore", "收货仓库": "receiverStore",

  "收件人姓名": "receiverName", "收件人": "receiverName", "收货人": "receiverName",
  "收货人姓名": "receiverName", "联系人": "receiverName",

  "收件人电话": "receiverPhone", "收件电话": "receiverPhone", "收货电话": "receiverPhone",
  "收货人电话": "receiverPhone", "手机号": "receiverPhone", "联系电话": "receiverPhone",
  "手机": "receiverPhone", "电话": "receiverPhone", "收货人手机号": "receiverPhone",

  "收件人地址": "receiverAddress", "收货地址": "receiverAddress", "收件地址": "receiverAddress",
  "送货地址": "receiverAddress", "详细地址": "receiverAddress", "地址": "receiverAddress",
  "配送地址": "receiverAddress", "收货地点": "receiverAddress",

  "备注": "remark", "附注": "remark", "说明": "remark", "备注信息": "remark",
};

const detailAliases: Record<string, DetailFieldKey> = {
  "SKU物品编码": "skuCode", "商品编码": "skuCode", "SKU编码": "skuCode",
  "物品编码": "skuCode", "货号": "skuCode", "物料编码": "skuCode",
  "产品编码": "skuCode", "编码": "skuCode",

  "SKU物品名称": "skuName", "商品名称": "skuName", "SKU名称": "skuName",
  "物品名称": "skuName", "产品名称": "skuName", "名称": "skuName",
  "货物名称": "skuName", "品名": "skuName",

  "SKU发货数量": "skuQty", "订货数量": "skuQty", "发货数量": "skuQty",
  "数量": "skuQty", "件数": "skuQty", "出库数量": "skuQty",
  "配送数量": "skuQty", "调拨数量": "skuQty",

  "SKU规格型号": "skuSpec", "规格": "skuSpec", "规格型号": "skuSpec",
  "型号": "skuSpec", "包装规格": "skuSpec", "计量单位": "skuSpec",
};

Object.assign(HEADER_ALIAS_MAP, headerAliases);
Object.assign(DETAIL_ALIAS_MAP, detailAliases);

export const REQUIRED_DETAIL_FIELDS: DetailFieldKey[] = ["skuCode", "skuName", "skuQty"];

// ============================================================
// 异常填充常量
// ============================================================

export const ERR_MISSING = "【缺失必填】";
export const ERR_QUANTITY = "【数量异常】";
export const ERR_NO_CONTACT = "【异常：收件姓名与电话同时缺失】";
export const ERR_NO_ADDRESS = "【异常：收货门店与收货地址同时缺失】";

// ============================================================
// 校验（使用英文key）
// ============================================================

export function validateHeader(h: Record<string, string>): string[] {
  const additions: string[] = [];
  const name = (h.receiverName || "").trim();
  const phone = (h.receiverPhone || "").trim();
  const store = (h.receiverStore || "").trim();
  const addr = (h.receiverAddress || "").trim();
  if (!name && !phone) additions.push(ERR_NO_CONTACT);
  if (!store && !addr) additions.push(ERR_NO_ADDRESS);
  return additions;
}

export function validateDetail(d: Record<string, string>): Record<string, string> {
  const result = { ...d };
  for (const f of REQUIRED_DETAIL_FIELDS) {
    if (!result[f] || result[f].trim() === "") result[f] = ERR_MISSING;
  }
  const qty = result.skuQty;
  if (qty && qty !== ERR_MISSING) {
    const num = Number(String(qty).replace(/[^0-9.]/g, ""));
    if (isNaN(num) || num <= 0) result.skuQty = ERR_QUANTITY;
  }
  return result;
}

// ============================================================
// 中文JSON输出转换
// ============================================================

export interface ParsedOrderOutput {
  header: Record<string, string>;
  detailList: Record<string, string>[];
}

/** 将内部英文key的数据转为中文key的JSON输出 */
export function toCnOutput(
  groups: { header: Record<string, string>; details: Record<string, string>[] }[],
): ParsedOrderOutput[] {
  return groups.map((g) => {
    const { remarkAdditions } = { remarkAdditions: validateHeader(g.header) };
    let remark = g.header.remark || "";
    if (remarkAdditions.length > 0) {
      remark = remark ? `${remark}；${remarkAdditions.join("；")}` : remarkAdditions.join("");
    }
    const header: Record<string, string> = {};
    for (const en of HEADER_EN_KEYS) {
      const cn = HEADER_CN[en];
      header[cn] = en === "remark" ? remark : (g.header[en] || "");
    }
    const detailList = g.details.map((d) => {
      const validated = validateDetail(d);
      const item: Record<string, string> = {};
      for (const en of DETAIL_EN_KEYS) {
        item[en] = validated[en] || "";
      }
      return item;
    });
    return { header, detailList };
  });
}

// ============================================================
// 前端草稿类型
// ============================================================

export type HeaderDraft = Record<HeaderFieldKey, string>;
export function emptyHeaderDraft(): HeaderDraft {
  return { externalCode: "", receiverStore: "", receiverName: "", receiverPhone: "", receiverAddress: "", remark: "" };
}

export type DetailDraft = Record<DetailFieldKey, string>;
export function emptyDetailDraft(): DetailDraft {
  return { skuCode: "", skuName: "", skuQty: "", skuSpec: "" };
}

export interface OrderGroup {
  id: string;
  header: HeaderDraft;
  details: DetailDraft[];
}

export type OrderRowDraft = Record<OrderFieldKey, string>;
export function emptyDraftRow(): OrderRowDraft {
  return { ...emptyHeaderDraft(), ...emptyDetailDraft() };
}
