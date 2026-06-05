"use client";

import { useState, useMemo } from "react";
import type { HeaderFieldKey, DetailFieldKey, OrderGroup, HeaderDraft, DetailDraft } from "@/lib/order-types";
import { HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS, FIELD_LABELS } from "@/lib/order-types";

type OrdersGridProps = {
  groups: OrderGroup[];
  rowFieldErrors: Map<string, string>;
  onUpdateHeader: (groupIndex: number, field: HeaderFieldKey, value: string) => void;
  onUpdateDetail: (groupIndex: number, detailIndex: number, field: DetailFieldKey, value: string) => void;
  onAddDetail: (groupIndex: number) => void;
  onDeleteDetail: (groupIndex: number, detailIndex: number) => void;
  onAddGroup: () => void;
  onDeleteGroup: (groupIndex: number) => void;
};

function errKey(displayRow: number, field: string): string {
  return `${displayRow}\u0000${field}`;
}

export function OrdersGrid({ groups, rowFieldErrors, onUpdateHeader, onUpdateDetail, onAddDetail, onDeleteDetail, onAddGroup, onDeleteGroup }: OrdersGridProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggle = (gi: number) => {
    setCollapsed((prev) => { const next = new Set(prev); if (next.has(gi)) next.delete(gi); else next.add(gi); return next; });
  };

  const summary = useMemo(() => {
    const detailCount = groups.reduce((s, g) => s + g.details.length, 0);
    const errCount = rowFieldErrors.size;
    return `${groups.length} 组 · ${detailCount} 条明细 · ${errCount > 0 ? `${errCount} 个错误` : "校验通过"}`;
  }, [groups, rowFieldErrors.size]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
        <span className="font-medium">{summary}</span>
        <button onClick={onAddGroup}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-600 hover:bg-gray-50 hover:border-[#0fc6c2] transition text-sm">
          + 新增订单组
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
          <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          暂无数据，请配置规则后生成预览。
        </div>
      ) : (
        <div className="space-y-3 max-h-[min(800px,75vh)] overflow-y-auto pr-1">
          {groups.map((group, gi) => {
            const isOpen = !collapsed.has(gi);
            const displayGroup = gi + 1;
            return (
              <div key={group.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* 头表信息行 */}
                <div className={`p-3 flex items-center justify-between cursor-pointer transition ${isOpen ? "bg-[#e8fafa]/50" : "bg-gray-50"}`}
                  onClick={() => toggle(gi)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#0fc6c2] transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "" }}>▶</span>
                    <span className="text-xs font-semibold text-gray-700">第 {displayGroup} 组</span>
                    <span className="text-xs text-gray-400 ml-1">{HEADER_FIELD_KEYS.map((k) => {
                      const val = group.header[k]?.trim(); return val ? <span key={k} className="mr-3">{FIELD_LABELS[k]}: {val}</span> : null;
                    })}</span>
                    <span className="px-1.5 py-0.5 bg-[#0fc6c2]/10 text-[#0fc6c2] text-[10px] rounded-full">{group.details.length} 条明细</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteGroup(gi); }}
                    className="text-xs text-red-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">删除整组</button>
                </div>

                {isOpen && (
                  <div className="p-3 space-y-3 border-t border-gray-100">
                    {/* 头表字段编辑 */}
                    <div className="grid grid-cols-3 gap-2">
                      {HEADER_FIELD_KEYS.map((field) => {
                        const ek = errKey(displayGroup, field);
                        const err = rowFieldErrors.get(ek);
                        return (
                          <div key={field} className="flex items-center gap-1">
                            <label className="text-[10px] text-gray-500 w-16 shrink-0">{FIELD_LABELS[field]}</label>
                            <input value={group.header[field]} onChange={(e) => onUpdateHeader(gi, field, e.target.value)}
                              className={`flex-1 h-7 px-2 border rounded text-xs outline-none transition ${
                                err ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300 focus:border-[#0fc6c2] focus:ring-1 focus:ring-[#0fc6c2]/30"}`} />
                          </div>
                        );
                      })}
                    </div>

                    {/* 明细表格 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">明细数据</span>
                        <button onClick={() => onAddDetail(gi)}
                          className="text-xs text-[#0fc6c2] hover:underline">+ 添加明细行</button>
                      </div>
                      <div className="overflow-x-auto rounded border border-gray-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-2 py-1.5 text-gray-500 font-medium text-left">#</th>
                              {DETAIL_FIELD_KEYS.map((k) => (
                                <th key={k} className="px-2 py-1.5 text-gray-500 font-medium text-left">{FIELD_LABELS[k]}
                                  {["skuCode","skuName","skuQty"].includes(k) && <span className="text-red-400 ml-0.5">*</span>}
                                </th>
                              ))}
                              <th className="px-2 py-1.5 w-16" />
                            </tr>
                          </thead>
                          <tbody>
                            {group.details.length === 0 ? (
                              <tr><td colSpan={DETAIL_FIELD_KEYS.length + 2} className="px-3 py-4 text-center text-gray-400">暂无明细</td></tr>
                            ) : group.details.map((detail, di) => {
                              const displayRow = displayGroup * 1000 + di + 1;
                              return (
                                <tr key={di} className="border-t border-gray-50 hover:bg-gray-50/50">
                                  <td className="px-2 py-1 text-gray-400">{di + 1}</td>
                                  {DETAIL_FIELD_KEYS.map((field) => {
                                    const ek = errKey(displayRow, field);
                                    const err = rowFieldErrors.get(ek);
                                    return (
                                      <td key={field} className="px-1 py-0.5">
                                        <input value={detail[field]} onChange={(e) => onUpdateDetail(gi, di, field, e.target.value)}
                                          className={`h-7 w-full px-1.5 border rounded text-xs outline-none ${
                                            err ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300 focus:border-[#0fc6c2] focus:ring-1 focus:ring-[#0fc6c2]/30"}`} />
                                      </td>
                                    );
                                  })}
                                  <td className="px-1">
                                    <button onClick={() => onDeleteDetail(gi, di)} className="text-red-400 hover:text-red-500 text-xs">删除</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
