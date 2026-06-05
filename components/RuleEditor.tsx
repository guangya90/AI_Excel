"use client";

import type { ParseRuleConfig, TransformType, FooterRule, RegionConfig } from "@/lib/rule-types";
import { HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS, FIELD_LABELS } from "@/lib/order-types";

interface RuleEditorProps {
  rule: Partial<ParseRuleConfig>;
  onChange: (rule: Partial<ParseRuleConfig>) => void;
  availableColumns?: string[];
  readOnly?: boolean;
  confidence?: Record<string, "high" | "medium" | "low">;
}

const CONFIDENCE_COLORS: Record<string, string> = { high: "text-green-500", medium: "text-yellow-500", low: "text-red-400" };
const CONFIDENCE_ICONS: Record<string, string> = { high: "✓", medium: "⚠", low: "✗" };

const TRANSFORM_OPTIONS: { value: TransformType; label: string }[] = [
  { value: "none", label: "标准映射（无变换）" },
  { value: "matrix_transpose", label: "矩阵转置（SKU×门店）" },
  { value: "cross_row_aggregate", label: "跨行聚合（按单号合并）" },
  { value: "card_split", label: "卡片拆分" },
  { value: "composite_cell_split", label: "复合单元格拆分" },
  { value: "text_parse", label: "纯文本解析" },
];

export default function RuleEditor({ rule, onChange, availableColumns, readOnly, confidence }: RuleEditorProps) {
  const disabled = !!readOnly;

  const updateField = <K extends keyof ParseRuleConfig>(key: K, value: ParseRuleConfig[K]) => {
    onChange({ ...rule, [key]: value });
  };
  const updateRegion = (key: string, value: unknown) => {
    onChange({ ...rule, region: { ...rule.region, [key]: value } as RegionConfig });
  };
  const updateHeaderColumn = (field: string, colName: string) => {
    const headerColumns = { ...rule.headerColumns, [field]: colName };
    if (!colName) delete headerColumns[field];
    onChange({ ...rule, headerColumns });
  };
  const updateDetailColumn = (field: string, colName: string) => {
    const detailColumns = { ...rule.detailColumns, [field]: colName };
    if (!colName) delete detailColumns[field];
    onChange({ ...rule, detailColumns });
  };
  const updateTransform = (type: TransformType) => {
    const config = type === rule.transform?.type ? rule.transform?.config : undefined;
    onChange({ ...rule, transform: { type, config } });
  };
  const addFooterRule = () => {
    const footer = [...(rule.footer || []), { field: "", pattern: "" }];
    onChange({ ...rule, footer });
  };
  const removeFooterRule = (index: number) => {
    const footer = (rule.footer || []).filter((_, i) => i !== index);
    onChange({ ...rule, footer });
  };

  const columns = availableColumns || [];

  return (
    <div className="space-y-6">
      {/* 基本信息 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">基本信息</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">规则名称</label>
            <input type="text" value={rule.name || ""} disabled={disabled}
              onChange={(e) => updateField("name", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]"
              placeholder="如：湖南仓发货单" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">适用格式</label>
            <select value={rule.fileFormat || "xlsx"} disabled={disabled}
              onChange={(e) => updateField("fileFormat", e.target.value as ParseRuleConfig["fileFormat"])}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="xls">Excel (.xls)</option>
              <option value="docx">Word (.docx)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">分组依据字段</label>
            <select value={rule.headerGroupBy || "externalCode"} disabled={disabled}
              onChange={(e) => updateField("headerGroupBy", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]">
              {HEADER_FIELD_KEYS.map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
              {DETAIL_FIELD_KEYS.map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 区域配置 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">区域配置</h3>
        <div className="grid grid-cols-3 gap-3">
          {(["headerSkipRows","headerRow","footerSkipRows"] as const).map((key) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">
                {key === "headerSkipRows" ? "跳过头部行数" : key === "headerRow" ? "表头行号(0-based)" : "跳过尾部行数"}
              </label>
              <input type="number" value={rule.region?.[key] ?? (key==="headerSkipRows" ? 0 : key==="headerRow" ? 0 : 0)}
                onChange={(e) => updateRegion(key, Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]" min={0} />
            </div>
          ))}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sheet过滤（可选）</label>
            <input type="text" value={rule.region?.sheetFilter || ""}
              onChange={(e) => updateRegion("sheetFilter", e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]" placeholder="指定Sheet名" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">数据起始行 (可选)</label>
            <input type="number" value={rule.region?.dataStartRow ?? ""}
              onChange={(e) => updateRegion("dataStartRow", e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]" placeholder="自动推断" />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={rule.region?.mergeSheets ?? false}
                onChange={(e) => updateRegion("mergeSheets", e.target.checked)}
                className="w-4 h-4 text-[#0fc6c2] rounded focus:ring-[#0fc6c2]" />
              <span className="text-xs text-gray-500">合并所有Sheet</span>
            </label>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">头表布局方向</label>
            <select value={rule.region?.headerLayout || "vertical"}
              onChange={(e) => updateRegion("headerLayout", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]">
              <option value="vertical">上下结构（列头在顶部）</option>
              <option value="horizontal">左右结构（键值对横向排列）</option>
              <option value="both">混合（两者都检测）</option>
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={rule.region?.extractFooterHeader ?? false}
                onChange={(e) => updateRegion("extractFooterHeader", e.target.checked)}
                className="w-4 h-4 text-[#0fc6c2] rounded focus:ring-[#0fc6c2]" />
              <span className="text-xs text-gray-500">从尾部提取头表字段</span>
            </label>
          </div>
        </div>
      </div>

      {/* 头表列映射 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          头表列映射（收货信息）
          {confidence && <span className="ml-2 text-xs text-gray-400 font-normal">（AI置信度: ✓高 ⚠中 ✗低）</span>}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {HEADER_FIELD_KEYS.map((field) => (
            <div key={field} className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-24 shrink-0">
                {FIELD_LABELS[field]}
                {confidence?.[field] && (
                  <span className={`ml-1 text-[10px] font-bold ${CONFIDENCE_COLORS[confidence[field]]}`}>{CONFIDENCE_ICONS[confidence[field]]}</span>
                )}
              </label>
              {columns.length > 0 ? (
                <select value={rule.headerColumns?.[field] || ""}
                  onChange={(e) => updateHeaderColumn(field, e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#0fc6c2]">
                  <option value="">-- 未映射 --</option>
                  {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
              ) : (
                <input type="text" value={rule.headerColumns?.[field] || ""}
                  onChange={(e) => updateHeaderColumn(field, e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#0fc6c2]" placeholder="输入源列名" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 明细列映射 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          明细列映射（SKU信息）
          <span className="ml-2 text-xs text-red-400 font-normal">* SKU编码、名称、数量为必填</span>
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {DETAIL_FIELD_KEYS.map((field) => (
            <div key={field} className="flex items-center gap-2">
              <label className="text-xs text-gray-600 w-24 shrink-0">
                {FIELD_LABELS[field]}
                {["skuCode","skuName","skuQty"].includes(field) && <span className="text-red-400 ml-0.5">*</span>}
                {confidence?.[field] && (
                  <span className={`ml-1 text-[10px] font-bold ${CONFIDENCE_COLORS[confidence[field]]}`}>{CONFIDENCE_ICONS[confidence[field]]}</span>
                )}
              </label>
              {columns.length > 0 ? (
                <select value={rule.detailColumns?.[field] || ""}
                  onChange={(e) => updateDetailColumn(field, e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#0fc6c2]">
                  <option value="">-- 未映射 --</option>
                  {columns.map((col) => <option key={col} value={col}>{col}</option>)}
                </select>
              ) : (
                <input type="text" value={rule.detailColumns?.[field] || ""}
                  onChange={(e) => updateDetailColumn(field, e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#0fc6c2]" placeholder="输入源列名" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 变换类型 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">变换类型</h3>
        <select value={rule.transform?.type || "none"}
          onChange={(e) => updateTransform(e.target.value as TransformType)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2]">
          {TRANSFORM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* 静态默认值（从扫描提取的KV中预填） */}
      {rule.defaults && Object.keys(rule.defaults).length > 0 && (
        <div className="bg-purple-50/50 rounded-xl border border-purple-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">默认值（从文件扫描提取）</h3>
          <div className="grid grid-cols-3 gap-3">
            {HEADER_FIELD_KEYS.map((field) => {
              const val = rule.defaults?.[field];
              return (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1">
                    {val ? (
                      <span className="text-purple-600">{FIELD_LABELS[field]}</span>
                    ) : (
                      <span className="text-gray-400">{FIELD_LABELS[field]}</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={val || ""}
                    onChange={(e) => {
                      const defaults = { ...rule.defaults };
                      if (e.target.value) defaults[field] = e.target.value;
                      else delete defaults[field];
                      onChange({ ...rule, defaults });
                    }}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2] ${
                      val ? "border-purple-200 bg-purple-50/30 text-purple-700 font-medium" : "border-gray-200 text-gray-400"
                    }`}
                    placeholder="—"
                  />
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-purple-400 mt-2">紫色高亮的字段来自文件扫描提取，将自动填入每条订单头表</p>
        </div>
      )}

      {/* 尾部信息提取 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">尾部信息提取规则</h3>
          <button onClick={addFooterRule} className="text-xs text-[#0fc6c2] font-medium hover:underline">+ 添加规则</button>
        </div>
        {(rule.footer || []).length === 0 ? (
          <p className="text-xs text-gray-400">暂无尾部提取规则</p>
        ) : (
          <div className="space-y-2">
            {(rule.footer || []).map((fr, i) => (
              <div key={i} className="flex items-center gap-2">
                <select value={fr.field}
                  onChange={(e) => { const f = [...(rule.footer||[])]; f[i]={...f[i],field:e.target.value}; onChange({...rule,footer:f}); }}
                  className="w-32 px-2 py-1.5 border border-gray-200 rounded text-xs">
                  <option value="">选择字段</option>
                  {[...HEADER_FIELD_KEYS, ...DETAIL_FIELD_KEYS].map((f) => (
                    <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                  ))}
                </select>
                <input type="text" value={fr.pattern}
                  onChange={(e) => { const f = [...(rule.footer||[])]; f[i]={...f[i],pattern:e.target.value}; onChange({...rule,footer:f}); }}
                  className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-xs" placeholder="正则或关键词" />
                <button onClick={() => removeFooterRule(i)} className="text-red-400 hover:text-red-500 text-xs">删除</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
