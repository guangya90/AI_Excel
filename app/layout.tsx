import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "万能导入 · 批量下单",
  description: "多模板 Excel 自动识别与批量运单导入",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen antialiased">
        <header className="border-b border-surface-border bg-surface-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight text-white">
              万能导入
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link className="hover:text-white" href="/import">
                导入下单
              </Link>
              <Link className="hover:text-white" href="/shipments">
                运单列表
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
