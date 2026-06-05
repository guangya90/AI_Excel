import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { z } from "zod";
import { prisma } from "@/lib/db";

/** 规则列表查询参数 */
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  fileFormat: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = querySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "查询参数无效" }, { status: 400 });
    }
    const { page, pageSize, search, fileFormat } = parsed.data;

    const where: Record<string, unknown> = {};
    if (search?.trim()) {
      where.name = { contains: search.trim(), mode: "insensitive" };
    }
    if (fileFormat?.trim()) {
      where.fileFormat = fileFormat.trim();
    }

    const [total, items] = await Promise.all([
      prisma.parseRule.count({ where }),
      prisma.parseRule.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      total,
      page,
      pageSize,
      items: items.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        fileFormat: r.fileFormat,
        config: r.config,
        signature: r.signature,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1, "规则名称不能为空"),
  description: z.string().optional(),
  fileFormat: z.enum(["xlsx", "xls", "docx", "pdf"]),
  config: z.record(z.unknown()),
  signature: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数无效", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const rule = await prisma.parseRule.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        fileFormat: parsed.data.fileFormat,
        config: parsed.data.config as object,
        signature: parsed.data.signature ?? null,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch {
    return NextResponse.json({ error: "创建规则失败" }, { status: 500 });
  }
}
