import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  pairs: z.array(z.object({ row: z.number().int().positive(), code: z.string().trim().min(1) })),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: "请求参数无效" }, { status: 400 });

    const { pairs } = parsed.data;
    const uniqueCodes = Array.from(new Set(pairs.map((p) => p.code)));
    if (uniqueCodes.length === 0) return NextResponse.json({ dbHits: [] });

    const existing = await prisma.orderHeader.findMany({
      where: { externalCode: { in: uniqueCodes } },
      select: { externalCode: true },
    });
    const hitSet = new Set(existing.map((e) => e.externalCode).filter((c): c is string => Boolean(c)));

    const byCode = new Map<string, number[]>();
    for (const p of pairs) {
      if (!hitSet.has(p.code)) continue;
      const arr = byCode.get(p.code) ?? [];
      arr.push(p.row);
      byCode.set(p.code, arr);
    }

    return NextResponse.json({
      dbHits: Array.from(byCode.entries()).map(([code, rows]) => ({ code, rows: [...new Set(rows)].sort((a, b) => a - b) })),
    });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
