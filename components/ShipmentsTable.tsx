"use client";

import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FIELD_LABELS, ORDER_FIELD_KEYS, type OrderFieldKey } from "@/lib/order-types";

type OrderDto = {
  id: string;
  batchId: string;
  externalCode: string | null;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weightKg: string;
  pieceCount: number;
  tempZone: string;
  remark: string | null;
  createdAt: string;
};

type ListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: OrderDto[];
};

const DISPLAY: readonly OrderFieldKey[] = ORDER_FIELD_KEYS;

export function ShipmentsTable() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [externalCode, setExternalCode] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(pageSize));
      if (externalCode.trim()) sp.set("externalCode", externalCode.trim());
      if (receiverName.trim()) sp.set("receiverName", receiverName.trim());
      if (from.trim()) sp.set("from", new Date(from).toISOString());
      if (to.trim()) sp.set("to", new Date(to).toISOString());
      const res = await fetch(`/api/orders?${sp.toString()}`);
      if (!res.ok) {
        toast.error("加载失败");
        return;
      }
      const json = (await res.json()) as ListResponse;
      setData(json);
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, externalCode, receiverName, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          外部编码
          <input
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            value={externalCode}
            onChange={(e) => {
              setPage(1);
              setExternalCode(e.target.value);
            }}
            placeholder="模糊搜索"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          收件人姓名
          <input
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            value={receiverName}
            onChange={(e) => {
              setPage(1);
              setReceiverName(e.target.value);
            }}
            placeholder="模糊搜索"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          提交时间起
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          提交时间止
          <input
            type="datetime-local"
            className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-sm text-slate-100"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>
          {data ? `共 ${data.total} 条` : "加载中…"}
          {loading ? "（刷新中）" : null}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-950/40">
        <table className="min-w-max w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-900">
            <tr className="border-b border-slate-700">
              <th className="whitespace-nowrap px-2 py-2 text-slate-300">提交时间</th>
              {DISPLAY.map((k) => (
                <th key={k} className="whitespace-nowrap px-2 py-2 text-slate-300">
                  {FIELD_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-100">
            {!data || data.items.length === 0 ? (
              <tr>
                <td colSpan={DISPLAY.length + 1} className="p-6 text-center text-slate-500">
                  {loading ? "加载中…" : "暂无数据"}
                </td>
              </tr>
            ) : (
              data.items.map((o) => (
                <tr key={o.id} className="border-b border-slate-800">
                  <td className="whitespace-nowrap px-2 py-2 text-slate-400">
                    {format(new Date(o.createdAt), "yyyy-MM-dd HH:mm", { locale: zhCN })}
                  </td>
                  <td className="px-2 py-2">{o.externalCode ?? "—"}</td>
                  <td className="px-2 py-2">{o.senderName}</td>
                  <td className="px-2 py-2">{o.senderPhone}</td>
                  <td className="max-w-[200px] truncate px-2 py-2" title={o.senderAddress}>
                    {o.senderAddress}
                  </td>
                  <td className="px-2 py-2">{o.receiverName}</td>
                  <td className="px-2 py-2">{o.receiverPhone}</td>
                  <td className="max-w-[200px] truncate px-2 py-2" title={o.receiverAddress}>
                    {o.receiverAddress}
                  </td>
                  <td className="px-2 py-2">{o.weightKg}</td>
                  <td className="px-2 py-2">{o.pieceCount}</td>
                  <td className="px-2 py-2">{o.tempZone}</td>
                  <td className="max-w-[160px] truncate px-2 py-2" title={o.remark ?? ""}>
                    {o.remark ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          上一页
        </button>
        <span className="text-sm text-slate-400">
          第 {page} / {totalPages} 页
        </span>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
