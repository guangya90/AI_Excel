import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { z } from "zod";
import { generateRule } from "@/lib/ai-rule-generator";

const bodySchema = z.object({
  fileName: z.string().min(1),
  fileFormat: z.string(),
  sheetNames: z.array(z.string()),
  headerPreview: z.string(),
  sampleRows: z.string(),
  totalRows: z.number().int().min(0),
  totalCols: z.number().int().min(0),
  textContent: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json: unknown = await req.json();
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "请求参数无效", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await generateRule(parsed.data);

    return NextResponse.json({
      success: true,
      rule: result.rule,
      confidence: result.confidence,
      reasoning: result.reasoning,
      rawResponse: result.rawResponse.slice(0, 2000),
      tokenUsage: result.tokenUsage,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI 生成规则失败";
    if (msg.includes("DEEPSEEK_API_KEY") || msg.includes("API 返回错误")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
