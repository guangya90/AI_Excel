import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { z } from "zod";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const rule = await prisma.parseRule.findUnique({ where: { id: params.id } });
    if (!rule) {
      return NextResponse.json({ error: "规则不存在" }, { status: 404 });
    }
    return NextResponse.json(rule);
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  fileFormat: z.enum(["xlsx", "xls", "docx", "pdf"]).optional(),
  config: z.record(z.unknown()).optional(),
  signature: z.string().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const json: unknown = await req.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数无效", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.fileFormat !== undefined) data.fileFormat = parsed.data.fileFormat;
    if (parsed.data.config !== undefined) data.config = parsed.data.config as object;
    if (parsed.data.signature !== undefined) data.signature = parsed.data.signature;

    const rule = await prisma.parseRule.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ success: true, rule });
  } catch {
    return NextResponse.json({ error: "更新规则失败" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.parseRule.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "删除规则失败" }, { status: 500 });
  }
}
