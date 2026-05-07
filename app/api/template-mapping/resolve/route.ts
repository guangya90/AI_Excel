import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeHeaderSignature } from "@/lib/header-signature-server";
import type { OrderFieldKey } from "@/lib/order-types";

const bodySchema = z.object({
  headers: z.array(z.string()),
  headerRowIndex: z.number().int().min(0).max(50),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "请求参数无效" }, { status: 400 });
    }
    const { headers, headerRowIndex } = parsed.data;
    const signature = computeHeaderSignature({ headers, headerRowIndex });
    const row = await prisma.templateMapping.findUnique({
      where: { headerSignature: signature },
    });
    const mapping = row?.fieldToColumn as Partial<Record<OrderFieldKey, string>> | null;
    return NextResponse.json({
      signature,
      savedMapping: mapping ?? null,
      savedHeaderRowIndex: row?.headerRowIndex ?? null,
    });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
