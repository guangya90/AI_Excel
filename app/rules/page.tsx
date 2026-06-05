"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RuleItem {
  id: string;
  name: string;
  description?: string;
  fileFormat: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const FORMAT_LABELS: Record<string, string> = {
  xlsx: "Excel",
  xls: "Excel",
  docx: "Word",
  pdf: "PDF",
};

const FORMAT_COLORS: Record<string, string> = {
  xlsx: "bg-green-50 text-green-600",
  xls: "bg-green-50 text-green-600",
  docx: "bg-blue-50 text-blue-600",
  pdf: "bg-red-50 text-red-600",
};

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/rules?${params}`);
      const data = await res.json();
      setRules(data.items || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("加载规则列表失败");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除规则「${name}」？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`已删除「${name}」`);
        fetchRules();
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleCopy = async (rule: RuleItem) => {
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${rule.name} (副本)`,
          fileFormat: rule.fileFormat,
          config: rule.config,
        }),
      });
      if (res.ok) {
        toast.success("规则已复制");
        fetchRules();
      }
    } catch {
      toast.error("复制失败");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen bg-[#f7f8fa] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">解析规则管理</h1>
            <p className="text-sm text-gray-500 mt-1">管理所有文件格式的解析规则，支持创建、编辑、复制和删除</p>
          </div>
          <button
            onClick={() => router.push("/import")}
            className="px-4 py-2 bg-[#0fc6c2] text-white text-sm font-medium rounded-lg hover:bg-[#0bada9] transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建规则
          </button>
        </div>

        {/* 搜索 */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索规则名称..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0fc6c2] focus:ring-1 focus:ring-[#0fc6c2] transition"
          />
        </div>

        {/* 表格 */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#0fc6c2] border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-gray-400 text-sm">加载中...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 font-medium mb-1">暂无解析规则</p>
            <p className="text-gray-400 text-sm mb-4">创建规则后，导入文件时可直接选用</p>
            <button
              onClick={() => router.push("/import")}
              className="px-4 py-2 bg-[#0fc6c2] text-white text-sm rounded-lg hover:bg-[#0bada9] transition"
            >
              去创建规则
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">规则名称</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">格式</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">创建时间</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-medium">更新时间</th>
                    <th className="px-4 py-3 text-right text-gray-500 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700">{rule.name}</span>
                        {rule.description && (
                          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{rule.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${FORMAT_COLORS[rule.fileFormat] || "bg-gray-50 text-gray-500"}`}>
                          {FORMAT_LABELS[rule.fileFormat] || rule.fileFormat}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(rule.createdAt).toLocaleDateString("zh-CN")}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(rule.updatedAt).toLocaleDateString("zh-CN")}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => router.push(`/import?ruleId=${rule.id}`)}
                            className="text-xs text-[#0fc6c2] hover:underline"
                          >
                            使用
                          </button>
                          <button
                            onClick={() => handleCopy(rule)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            复制
                          </button>
                          <button
                            onClick={() => handleDelete(rule.id, rule.name)}
                            className="text-xs text-red-400 hover:text-red-500"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#0fc6c2] transition"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:border-[#0fc6c2] transition"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
