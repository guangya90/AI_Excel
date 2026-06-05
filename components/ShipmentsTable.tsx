"use client";

import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FIELD_LABELS, HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS } from "@/lib/order-types";

type OrderDetail = { id: string; skuCode: string | null; skuName: string | null; skuQty: number | null; skuSpec: string | null };
type OrderHeaderDto = {
  id: string; batchId: string;
  externalCode: string | null; receiverStore: string | null;
  receiverName: string | null; receiverPhone: string | null; receiverAddress: string | null;
  remark: string | null;
  detailCount: number; details: OrderDetail[];
  createdAt: string;
};
type ListResponse = { total: number; page: number; pageSize: number; items: OrderHeaderDto[] };

const fmt = (v: unknown): string => (v === null || v === undefined ? "—" : String(v));

export function ShipmentsTable() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [keyword, setKeyword] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page)); sp.set("pageSize", String(pageSize));
      if (keyword.trim()) sp.set("keyword", keyword.trim());
      if (from.trim()) sp.set("from", new Date(from).toISOString());
      if (to.trim()) sp.set("to", new Date(to).toISOString());
      const res = await fetch(`/api/orders?${sp.toString()}`);
      if (!res.ok) { toast.error("加载失败"); return; }
      setData(await res.json() as ListResponse);
    } catch { toast.error("网络错误"); } finally { setLoading(false); }
  }, [page, keyword, from, to]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            关键词搜索
            <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#0fc6c2] focus:ring-1 focus:ring-[#0fc6c2]/30"
              value={keyword} onChange={(e) => { setPage(1); setKeyword(e.target.value); }} placeholder="外部编码/门店/姓名" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            提交时间起
            <input type="datetime-local" className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#0fc6c2]"
              value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            提交时间止
            <input type="datetime-local" className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#0fc6c2]"
              value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
          </label>
          <div className="flex items-end pb-1">
            <button onClick={() => void load()} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">刷新</button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{data ? `共 ${data.total} 组订单` : "加载中..."}</span>
      </div>

      <div className="space-y-3">
        {!data || data.items.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-400">
            {loading ? <div className="flex items-center justify-center gap-2"><div className="animate-spin w-4 h-4 border-2 border-[#0fc6c2] border-t-transparent rounded-full" />加载中...</div> : "暂无数据"}
          </div>
        ) : (
          data.items.map((o) => {
            const isOpen = expanded.has(o.id);
            return (
              <div key={o.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => toggleExpand(o.id)}>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-[#0fc6c2] transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "" }}>▶</span>
                    <span className="text-gray-500">{format(new Date(o.createdAt), "MM-dd HH:mm", { locale: zhCN })}</span>
                    <span className="font-medium text-gray-700">{o.externalCode || "—"}</span>
                    <span className="text-gray-500">{o.receiverStore || o.receiverName || "—"}</span>
                    <span className="px-1.5 py-0.5 bg-[#e8fafa] text-[#0fc6c2] text-xs rounded-full">{o.detailCount} 条明细</span>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100 p-3">
                    <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
                      {HEADER_FIELD_KEYS.map((k) => (
                        <div key={k} className="text-gray-500"><span className="text-gray-400">{FIELD_LABELS[k]}: </span>{fmt(o[k as keyof OrderHeaderDto])}</div>
                      ))}
                    </div>
                    <div className="overflow-x-auto rounded border border-gray-100">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-gray-50">
                          {DETAIL_FIELD_KEYS.map((k) => <th key={k} className="px-2 py-1.5 text-left text-gray-500 font-medium">{FIELD_LABELS[k]}</th>)}
                        </tr></thead>
                        <tbody>
                          {o.details.map((d) => (
                            <tr key={d.id} className="border-t border-gray-50">
                              <td className="px-2 py-1 text-gray-700">{fmt(d.skuCode)}</td>
                              <td className="px-2 py-1 text-gray-700">{fmt(d.skuName)}</td>
                              <td className="px-2 py-1 text-gray-700">{fmt(d.skuQty)}</td>
                              <td className="px-2 py-1 text-gray-700">{fmt(d.skuSpec)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">上一页</button>
        <span className="text-sm text-gray-500">第 {page} / {totalPages} 页</span>
        <button disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">下一页</button>
      </div>
    </div>
  );
}
