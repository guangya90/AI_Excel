import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ORDER_FIELD_KEYS, type OrderFieldKey } from "@/lib/order-types";
import { isCompleteMapping } from "@/lib/column-mapping";

const bodySchema = z.object({
  signature: z.string().min(8),
  headerRowIndex: z.number().int().min(0).max(50),
  fieldToColumn: z.record(z.string()),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数无效" }, { status: 400 });
    }
    const { signature, headerRowIndex, fieldToColumn } = parsed.data;
    const mapping: Partial<Record<OrderFieldKey, string>> = {};
    for (const k of ORDER_FIELD_KEYS) {
      const v = fieldToColumn[k];
      if (typeof v === "string" && v.trim()) mapping[k] = v.trim();
    }
    if (!isCompleteMapping(mapping)) {
      return NextResponse.json({ error: "映射不完整，必填字段必须全部指定" }, { status: 400 });
    }

    await prisma.templateMapping.upsert({
      where: { headerSignature: signature },
      create: {
        headerSignature: signature,
        headerRowIndex,
        fieldToColumn: mapping,
      },
      update: {
        headerRowIndex,
        fieldToColumn: mapping,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
