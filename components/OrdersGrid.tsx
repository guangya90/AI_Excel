"use client";

import { useMemo } from "react";
import type { OrderFieldKey, OrderRowDraft } from "@/lib/order-types";
import { FIELD_LABELS, ORDER_FIELD_KEYS } from "@/lib/order-types";

type OrdersGridProps = {
  rows: OrderRowDraft[];
  rowFieldErrors: Map<string, string>;
  onChange: (rowIndex: number, field: OrderFieldKey, value: string) => void;
  onDeleteRow: (rowIndex: number) => void;
  onAddRow: () => void;
};

const COL_WIDTH: Record<OrderFieldKey, string> = {
  externalCode: "min-w-[100px]",
  senderName: "min-w-[100px]",
  senderPhone: "min-w-[110px]",
  senderAddress: "min-w-[180px]",
  receiverName: "min-w-[100px]",
  receiverPhone: "min-w-[110px]",
  receiverAddress: "min-w-[180px]",
  weightKg: "min-w-[72px]",
  pieceCount: "min-w-[64px]",
  tempZone: "min-w-[80px]",
  remark: "min-w-[140px]",
};

function errKey(rowDisplay: number, field: OrderFieldKey): string {
  return `${rowDisplay}\u0000${field}`;
}

export function OrdersGrid({
  rows,
  rowFieldErrors,
  onChange,
  onDeleteRow,
  onAddRow,
}: OrdersGridProps) {
  const fields = ORDER_FIELD_KEYS;

  const summary = useMemo(() => {
    const errs = rowFieldErrors.size;
    return `${rows.length} 行 · ${errs > 0 ? `${errs} 个单元格待修正` : "校验通过"}`;
  }, [rowFieldErrors.size, rows.length]);

  const focusAt = (rowIndex: number, fieldIndex: number) => {
    const el = document.getElementById(`cell-${rowIndex}-${fieldIndex}`)?.querySelector("input");
    (el as HTMLInputElement | undefined)?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>{summary}</span>
        <button
          type="button"
          onClick={onAddRow}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
        >
          新增空行
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/50">
        <div className="max-h-[min(560px,70vh)] overflow-auto">
          <table className="min-w-max w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-900 shadow-md">
              <tr className="border-b border-slate-700">
                <th className="sticky left-0 z-30 bg-slate-900 px-2 py-2 text-slate-400">#</th>
                {fields.map((f) => (
                  <th
                    key={f}
                    className={`whitespace-nowrap px-2 py-2 font-medium text-slate-200 ${COL_WIDTH[f]}`}
                  >
                    {FIELD_LABELS[f]}
                  </th>
                ))}
                <th className="sticky right-0 z-30 min-w-[64px] bg-slate-900 px-2 py-2 text-slate-400">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 2} className="p-6 text-center text-slate-500">
                    暂无数据，请返回上传或新增空行。
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const displayRow = rowIndex + 1;
                  return (
                    <tr
                      key={rowIndex}
                      className="border-b border-slate-800 [content-visibility:auto] [contain-intrinsic-size:40px]"
                    >
                      <td className="sticky left-0 z-10 bg-slate-950/95 px-2 text-slate-500">{displayRow}</td>
                      {fields.map((field, fi) => {
                        const ek = errKey(displayRow, field);
                        const err = rowFieldErrors.get(ek);
                        const ring = err ? "ring-1 ring-red-500/80" : "";
                        return (
                          <td key={field} className={`p-0.5 ${COL_WIDTH[field]}`} title={err ?? undefined}>
                            <div id={`cell-${rowIndex}-${fi}`}>
                              <input
                                className={`h-8 w-full rounded border border-slate-700 bg-slate-900/80 px-1.5 text-xs outline-none focus:border-accent ${ring}`}
                                value={row[field]}
                                aria-invalid={Boolean(err)}
                                onChange={(e) => onChange(rowIndex, field, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Tab") {
                                    e.preventDefault();
                                    const next = fi + (e.shiftKey ? -1 : 1);
                                    if (next >= 0 && next < fields.length) focusAt(rowIndex, next);
                                    else if (next >= fields.length && rowIndex + 1 < rows.length)
                                      focusAt(rowIndex + 1, 0);
                                    else if (next < 0 && rowIndex > 0) focusAt(rowIndex - 1, fields.length - 1);
                                  } else if (e.key === "Enter") {
                                    e.preventDefault();
                                    if (rowIndex + 1 < rows.length) focusAt(rowIndex + 1, fi);
                                  }
                                }}
                              />
                            </div>
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-10 bg-slate-950/95 px-1 text-right">
                        <button
                          type="button"
                          className="rounded px-2 py-1 text-red-400 hover:bg-red-500/10"
                          onClick={() => onDeleteRow(rowIndex)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
