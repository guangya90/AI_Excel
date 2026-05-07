import { z } from "zod";

/** Canonical field keys stored in DB and used in the grid */
export const ORDER_FIELD_KEYS = [
  "externalCode",
  "senderName",
  "senderPhone",
  "senderAddress",
  "receiverName",
  "receiverPhone",
  "receiverAddress",
  "weightKg",
  "pieceCount",
  "tempZone",
  "remark",
] as const;

export type OrderFieldKey = (typeof ORDER_FIELD_KEYS)[number];

export const TEMP_ZONES = ["常温", "冷藏", "冷冻"] as const;
export type TempZone = (typeof TEMP_ZONES)[number];

/** Chinese mainland mobile: 11 digits, 1[3-9]... */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;

export const orderRowSchema = z.object({
  externalCode: z.string().trim().optional().transform((v) => (v === "" ? undefined : v)),
  senderName: z.string().trim().min(1, "发件人姓名不能为空"),
  senderPhone: z
    .string()
    .trim()
    .min(1, "发件人电话不能为空")
    .refine((v) => PHONE_REGEX.test(v.replace(/\s/g, "")), "发件人电话格式错误"),
  senderAddress: z.string().trim().min(1, "发件人地址不能为空"),
  receiverName: z.string().trim().min(1, "收件人姓名不能为空"),
  receiverPhone: z
    .string()
    .trim()
    .min(1, "收件人电话不能为空")
    .refine((v) => PHONE_REGEX.test(v.replace(/\s/g, "")), "收件人电话格式错误"),
  receiverAddress: z.string().trim().min(1, "收件人地址不能为空"),
  weightKg: z.coerce
    .number({ invalid_type_error: "重量必须是数字" })
    .positive("重量必须大于 0"),
  pieceCount: z.coerce
    .number({ invalid_type_error: "件数必须是数字" })
    .int("件数必须是整数")
    .min(1, "件数至少为 1"),
  tempZone: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.enum(TEMP_ZONES, {
      errorMap: () => ({ message: "温层只能是：常温 / 冷藏 / 冷冻" }),
    }),
  ),
  remark: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v.trim() === "" ? undefined : v.trim())),
});

export type OrderRowInput = z.infer<typeof orderRowSchema>;

export type OrderRowDraft = {
  [K in OrderFieldKey]: string;
};

export function emptyDraftRow(): OrderRowDraft {
  return {
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
}

export const FIELD_LABELS: Record<OrderFieldKey, string> = {
  externalCode: "外部编码",
  senderName: "发件人姓名",
  senderPhone: "发件人电话",
  senderAddress: "发件人地址",
  receiverName: "收件人姓名",
  receiverPhone: "收件人电话",
  receiverAddress: "收件人地址",
  weightKg: "重量(kg)",
  pieceCount: "件数",
  tempZone: "温层",
  remark: "备注",
};

export const REQUIRED_FIELDS: OrderFieldKey[] = [
  "senderName",
  "senderPhone",
  "senderAddress",
  "receiverName",
  "receiverPhone",
  "receiverAddress",
  "weightKg",
  "pieceCount",
  "tempZone",
];
