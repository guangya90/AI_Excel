"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface RuleSummary {
  id: string;
  name: string;
  description?: string;
  fileFormat: string;
  createdAt: string;
  updatedAt: string;
}

interface RuleSelectorProps {
  onSelect: (ruleId: string) => void;
  onCreateNew: () => void;
  selectedId?: string;
}

const FORMAT_LABELS: Record<string, string> = {
  xlsx: "Excel",
  xls: "Excel",
  docx: "Word",
  pdf: "PDF",
};

export default function RuleSelector({ onSelect, onCreateNew, selectedId }: RuleSelectorProps) {
  const [rules, setRules] = useState<RuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/rules?${params}`);
      const data = await res.json();
      if (data.items) setRules(data.items);
    } catch {
      toast.error("加载规则列表失败");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleDelete = async (e: React.MouseEvent, ruleId: string, ruleName: string) => {
    e.stopPropagation();
    if (!confirm(`确认删除规则「${ruleName}」？此操作不可撤销。`)) return;
    setDeleting(ruleId);
    try {
      const res = await fetch(`/api/rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success(`已删除「${ruleName}」`);
      fetchRules();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-[#0fc6c2] border-t-transparent rounded-full mx-auto mb-3" />
        <p>加载规则列表...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索规则..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0fc6c2] focus:ring-1 focus:ring-[#0fc6c2] transition"
          />
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#0fc6c2] text-white text-sm font-medium rounded-lg hover:bg-[#0bada9] transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建规则
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 text-sm mb-3">暂无解析规则</p>
          <button onClick={onCreateNew} className="text-[#0fc6c2] text-sm font-medium hover:underline">
            创建第一条规则
          </button>
        </div>
      ) : (
        <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              onClick={() => onSelect(rule.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer relative group ${
                selectedId === rule.id
                  ? "border-[#0fc6c2] bg-[#e8fafa] shadow-sm"
                  : "border-gray-100 bg-white hover:border-[#0fc6c2]/40 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-800">{rule.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {FORMAT_LABELS[rule.fileFormat] || rule.fileFormat}
                  </span>
                  <button
                    onClick={(e) => handleDelete(e, rule.id, rule.name)}
                    disabled={deleting === rule.id}
                    className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition disabled:opacity-40"
                  >
                    {deleting === rule.id ? "..." : "删除"}
                  </button>
                </div>
              </div>
              {rule.description && (
                <p className="text-xs text-gray-400 line-clamp-1">{rule.description}</p>
              )}
              <p className="text-xs text-gray-300 mt-2">
                更新于 {new Date(rule.updatedAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
