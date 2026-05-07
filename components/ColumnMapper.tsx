"use client";

import { useMemo, useState } from "react";
import type { OrderFieldKey } from "@/lib/order-types";
import { FIELD_LABELS, ORDER_FIELD_KEYS, REQUIRED_FIELDS } from "@/lib/order-types";
import { isCompleteMapping } from "@/lib/column-mapping";

type ColumnMapperProps = {
  excelHeaders: string[];
  initialMapping: Partial<Record<OrderFieldKey, string>>;
  onConfirm: (mapping: Partial<Record<OrderFieldKey, string>>) => void;
  onCancel?: () => void;
};

export function ColumnMapper({ excelHeaders, initialMapping, onConfirm, onCancel }: ColumnMapperProps) {
  const headers = useMemo(() => excelHeaders.filter((h) => h.trim() !== ""), [excelHeaders]);
  const [mapping, setMapping] = useState<Partial<Record<OrderFieldKey, string>>>(initialMapping);

  const setField = (field: OrderFieldKey, col: string) => {
    setMapping((m) => ({ ...m, [field]: col === "" ? undefined : col }));
  };

  const ready = isCompleteMapping(mapping);

  return (
    <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <div>
        <h3 className="text-base font-semibold text-white">列映射</h3>
        <p className="mt-1 text-sm text-slate-400">
          自动识别未覆盖全部必填字段时，请为每个系统字段选择对应的 Excel 列。确认后将保存为模板规则，下次相同表头结构会自动套用。
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ORDER_FIELD_KEYS.map((field) => {
          const required = REQUIRED_FIELDS.includes(field);
          return (
            <label key={field} className="flex flex-col gap-1 text-sm">
              <span className="text-slate-300">
                {FIELD_LABELS[field]}
                {required ? <span className="text-red-400"> *</span> : null}
              </span>
              <select
                className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-slate-100"
                value={mapping[field] ?? ""}
                onChange={(e) => setField(field, e.target.value)}
              >
                <option value="">（不导入）</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => ready && onConfirm(mapping)}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          确认映射并预览
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            返回
          </button>
        ) : null}
      </div>
    </div>
  );
}
