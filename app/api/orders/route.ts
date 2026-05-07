import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  externalCode: z.string().optional(),
  receiverName: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "查询参数无效" }, { status: 400 });
    }
    const { page, pageSize, externalCode, receiverName, from, to } = parsed.data;
    const filters: Prisma.OrderWhereInput[] = [];
    if (externalCode?.trim()) {
      filters.push({
        externalCode: { contains: externalCode.trim(), mode: "insensitive" },
      });
    }
    if (receiverName?.trim()) {
      filters.push({
        receiverName: { contains: receiverName.trim(), mode: "insensitive" },
      });
    }
    const createdFilter: Prisma.DateTimeFilter = {};
    if (from?.trim()) createdFilter.gte = new Date(from);
    if (to?.trim()) createdFilter.lte = new Date(to);
    if (Object.keys(createdFilter).length > 0) {
      filters.push({ createdAt: createdFilter });
    }
    const where: Prisma.OrderWhereInput = filters.length > 0 ? { AND: filters } : {};

    const [total, items] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      items: items.map((o) => ({
        id: o.id,
        batchId: o.batchId,
        externalCode: o.externalCode,
        senderName: o.senderName,
        senderPhone: o.senderPhone,
        senderAddress: o.senderAddress,
        receiverName: o.receiverName,
        receiverPhone: o.receiverPhone,
        receiverAddress: o.receiverAddress,
        weightKg: o.weightKg.toString(),
        pieceCount: o.pieceCount,
        tempZone: o.tempZone,
        remark: o.remark,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
