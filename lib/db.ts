import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "[database] 未找到环境变量 DATABASE_URL。本地：在仓库根目录（与 package.json 同级）创建 .env，写入 DATABASE_URL 与 DIRECT_URL；Vercel：Project → Settings → Environment Variables 中为 Production 添加 DATABASE_URL（及 DIRECT_URL），保存后 Redeploy。",
    );
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
