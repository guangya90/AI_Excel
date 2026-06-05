"use client";

import { useState } from "react";
import type { ParseRuleConfig, ParsedDocument } from "@/lib/rule-types";
import { executeRuleHD } from "@/lib/rule-engine";
import { FIELD_LABELS, HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS } from "@/lib/order-types";

interface RuleTestPreviewProps {
  rule: Partial<ParseRuleConfig>;
  document: ParsedDocument | null;
  onConfirm: () => void;
}

export default function RuleTestPreview({ rule, document, onConfirm }: RuleTestPreviewProps) {
  const [result, setResult] = useState<{
    success: boolean; groups: { header: Record<string,string>; details: Record<string,string>[] }[];
    errors: string[]; warnings: string[];
    stats: { totalRows: number; groupsCount: number; detailsCount: number; skippedRows: number; footerExtracted: boolean };
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = () => {
    if (!document || !rule.name) return;
    setTesting(true);
    setTimeout(() => {
      try {
        const res = executeRuleHD(document, rule as ParseRuleConfig);
        setResult(res);
      } catch (e) {
        setResult({ success: false, groups: [], errors: [e instanceof Error ? e.message : "测试解析异常"], warnings: [], stats: { totalRows: 0, groupsCount: 0, detailsCount: 0, skippedRows: 0, footerExtracted: false } });
      }
      setTesting(false);
    }, 100);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">试解析预览（头表+明细）</h3>
        <div className="flex gap-2">
          <button onClick={runTest} disabled={!document || !rule.name || testing}
            className="px-4 py-2 bg-[#0fc6c2] text-white text-sm font-medium rounded-lg hover:bg-[#0bada9] transition disabled:opacity-50">
            {testing ? "解析中..." : "试解析"}
          </button>
          {result?.success && (
            <button onClick={onConfirm}
              className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition">确认保存规则</button>
          )}
        </div>
      </div>

      {!result && <div className="text-center py-8 text-gray-400 text-sm"><p>点击 「试解析」 查看当前规则的解析结果</p></div>}

      {result && (
        <>
          <div className="flex gap-4 text-xs">
            <div className="bg-gray-50 rounded-lg px-3 py-2"><span className="text-gray-400">总行数</span><span className="ml-2 font-semibold text-gray-700">{result.stats.totalRows}</span></div>
            <div className="bg-[#e8fafa] rounded-lg px-3 py-2"><span className="text-gray-400">订单组</span><span className="ml-2 font-semibold text-[#0fc6c2]">{result.stats.groupsCount}</span></div>
            <div className="bg-green-50 rounded-lg px-3 py-2"><span className="text-gray-400">明细条数</span><span className="ml-2 font-semibold text-green-600">{result.stats.detailsCount}</span></div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}

          {result.groups.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {result.groups.slice(0, 10).map((group, gi) => (
                <div key={gi} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-600">第{gi+1}组</span>
                    <span className="text-[10px] text-gray-400">
                      {HEADER_FIELD_KEYS.map((k) => group.header[k] ? `${FIELD_LABELS[k]}: ${group.header[k]}` : null).filter(Boolean).join(" | ")}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead><tr className="bg-gray-50">
                        {DETAIL_FIELD_KEYS.map((k) => <th key={k} className="px-1.5 py-1 text-gray-500 text-left">{FIELD_LABELS[k]}</th>)}
                      </tr></thead>
                      <tbody>
                        {group.details.slice(0, 5).map((d, di) => (
                          <tr key={di} className="border-t border-gray-50">
                            {DETAIL_FIELD_KEYS.map((k) => <td key={k} className="px-1.5 py-0.5 text-gray-700">{d[k] || "-"}</td>)}
                          </tr>
                        ))}
                        {group.details.length > 5 && (
                          <tr><td colSpan={DETAIL_FIELD_KEYS.length} className="text-center py-1 text-gray-400">... 共 {group.details.length} 条</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {result.groups.length > 10 && (
                <div className="text-center py-2 text-xs text-gray-400">仅展示前 10 组，共 {result.groups.length} 组</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
