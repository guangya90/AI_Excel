import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "查询参数无效" }, { status: 400 });
    const { page, pageSize, keyword, from, to } = parsed.data;

    const filters: Prisma.OrderHeaderWhereInput[] = [];
    if (keyword?.trim()) {
      const kw = keyword.trim();
      filters.push({
        OR: [
          { externalCode: { contains: kw, mode: "insensitive" } },
          { receiverStore: { contains: kw, mode: "insensitive" } },
          { receiverName: { contains: kw, mode: "insensitive" } },
        ],
      });
    }
    const createdFilter: Prisma.DateTimeFilter = {};
    if (from?.trim()) createdFilter.gte = new Date(from);
    if (to?.trim()) createdFilter.lte = new Date(to);
    if (Object.keys(createdFilter).length > 0) filters.push({ createdAt: createdFilter });

    const where: Prisma.OrderHeaderWhereInput = filters.length > 0 ? { AND: filters } : {};

    const [total, items] = await Promise.all([
      prisma.orderHeader.count({ where }),
      prisma.orderHeader.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          details: { orderBy: { createdAt: "asc" } },
          _count: { select: { details: true } },
        },
      }),
    ]);

    return NextResponse.json({
      total, page, pageSize,
      items: items.map((o) => ({
        id: o.id,
        batchId: o.batchId,
        externalCode: o.externalCode,
        receiverStore: o.receiverStore,
        receiverName: o.receiverName,
        receiverPhone: o.receiverPhone,
        receiverAddress: o.receiverAddress,
        remark: o.remark,
        detailCount: o._count.details,
        details: o.details.map((d) => ({
          id: d.id,
          skuCode: d.skuCode,
          skuName: d.skuName,
          skuQty: d.skuQty,
          skuSpec: d.skuSpec,
        })),
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ total: 0, page: 1, pageSize: 20, items: [] });
  }
}
