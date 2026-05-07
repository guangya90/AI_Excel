import { NextResponse } from "next/server";

export const runtime = "nodejs";
import { z } from "zod";
import { computeHeaderSignature } from "@/lib/header-signature-server";

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
    const signature = computeHeaderSignature(parsed.data);
    return NextResponse.json({ signature });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
