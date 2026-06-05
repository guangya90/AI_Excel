import type { Metadata } from "next";
import { Toaster } from "sonner";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "万能导入 V2 · 智能批量下单",
  description: "支持 Excel/Word/PDF 多格式智能解析与批量运单导入",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased bg-[#f7f8fa]">
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
