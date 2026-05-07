import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { TEMP_ZONES, orderRowSchema } from "@/lib/order-types";
import { Prisma } from "@prisma/client";

const rowSchema = z.object({
  externalCode: z.string().trim().optional(),
  senderName: z.string(),
  senderPhone: z.string(),
  senderAddress: z.string(),
  receiverName: z.string(),
  receiverPhone: z.string(),
  receiverAddress: z.string(),
  weightKg: z.number().positive(),
  pieceCount: z.number().int().min(1),
  tempZone: z.enum(TEMP_ZONES),
  remark: z.string().optional(),
});

const bodySchema = z.object({
  batchId: z.string().min(8),
  rows: z.array(rowSchema).min(1).max(2000),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数无效", details: parsed.error.flatten() }, { status: 400 });
    }
    const { batchId, rows } = parsed.data;

    const normalized = rows.map((r) => {
      const v = orderRowSchema.safeParse({
        ...r,
        senderPhone: r.senderPhone.replace(/\s/g, ""),
        receiverPhone: r.receiverPhone.replace(/\s/g, ""),
      });
      if (!v.success) {
        throw new Error(v.error.issues[0]?.message ?? "校验失败");
      }
      return v.data;
    });

    const data = normalized.map((r) => ({
      batchId,
      externalCode: r.externalCode ?? null,
      senderName: r.senderName,
      senderPhone: r.senderPhone.replace(/\s/g, ""),
      senderAddress: r.senderAddress,
      receiverName: r.receiverName,
      receiverPhone: r.receiverPhone.replace(/\s/g, ""),
      receiverAddress: r.receiverAddress,
      weightKg: new Prisma.Decimal(r.weightKg),
      pieceCount: r.pieceCount,
      tempZone: r.tempZone,
      remark: r.remark ?? null,
    }));

    const result = await prisma.order.createMany({ data });
    return NextResponse.json({
      success: result.count,
      failed: rows.length - result.count,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "服务器错误";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
