"use client";

import Link from "next/link";
import { useState } from "react";
import SettingsModal from "@/components/SettingsModal";

const navLinks = [
  { href: "/import", label: "导入下单" },
  { href: "/rules", label: "规则管理" },
  { href: "/shipments", label: "运单列表" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0fc6c2] to-[#0bada9] flex items-center justify-center text-white font-bold text-sm">U</div>
            <span className="text-lg font-bold text-gray-800 group-hover:text-[#0fc6c2] transition">万能导入</span>
            <span className="text-xs bg-[#e8fafa] text-[#0fc6c2] px-1.5 py-0.5 rounded font-medium">V2</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="px-4 py-2 text-sm text-gray-600 hover:text-[#0fc6c2] hover:bg-[#e8fafa] rounded-lg transition font-medium">
                {link.label}
              </Link>
            ))}
            <button onClick={() => setSettingsOpen(true)}
              className="ml-2 px-3 py-2 text-sm text-gray-400 hover:text-[#0fc6c2] hover:bg-[#e8fafa] rounded-lg transition" title="系统设置">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pt-20 pb-12">{children}</main>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
