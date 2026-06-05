import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  batchId: z.string().min(8),
  groups: z.array(
    z.object({
      header: z.object({
        externalCode: z.string().optional(),
        receiverStore: z.string().optional(),
        receiverName: z.string().optional(),
        receiverPhone: z.string().optional(),
        receiverAddress: z.string().optional(),
        remark: z.string().optional(),
      }),
      details: z.array(
        z.object({
          skuCode: z.string(),
          skuName: z.string(),
          skuQty: z.number().int().positive(),
          skuSpec: z.string().optional(),
        }),
      ).min(1),
    }),
  ).min(1).max(500),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数无效", details: parsed.error.flatten() }, { status: 400 });
    }
    const { batchId, groups } = parsed.data;

    let successCount = 0;
    let failedCount = 0;

    for (const group of groups) {
      try {
        await prisma.orderHeader.create({
          data: {
            batchId,
            externalCode: group.header.externalCode?.trim() || null,
            receiverStore: group.header.receiverStore?.trim() || null,
            receiverName: group.header.receiverName?.trim() || null,
            receiverPhone: group.header.receiverPhone?.replace(/\s/g, "") || null,
            receiverAddress: group.header.receiverAddress?.trim() || null,
            remark: group.header.remark?.trim() || null,
            details: {
              create: group.details.map((d) => ({
                skuCode: d.skuCode,
                skuName: d.skuName,
                skuQty: d.skuQty,
                skuSpec: d.skuSpec?.trim() || null,
              })),
            },
          },
        });
        successCount++;
      } catch {
        failedCount++;
      }
    }

    return NextResponse.json({ success: successCount, failed: failedCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
