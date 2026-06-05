import { NextResponse } from "next/server";
export const runtime = "nodejs";
import { prisma } from "@/lib/db";

const ALLOWED_KEYS = ["deepseek_api_key", "ai_model"] as const;

export async function GET() {
  try {
    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ALLOWED_KEYS as unknown as string[] } },
    });
    const map: Record<string, string> = {};
    for (const s of settings) {
      // 敏感信息脱敏显示
      if (s.key === "deepseek_api_key" && s.value.length > 8) {
        map[s.key] = s.value.slice(0, 4) + "****" + s.value.slice(-4);
      } else {
        map[s.key] = s.value;
      }
    }
    return NextResponse.json({ settings: map });
  } catch {
    return NextResponse.json({ error: "读取设置失败" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
    }

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key as typeof ALLOWED_KEYS[number])) continue;
      await prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "保存设置失败" }, { status: 500 });
  }
}
