import { ShipmentsTable } from "@/components/ShipmentsTable";

export default function ShipmentsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-white">已导入运单</h1>
      <p className="text-sm text-slate-400">数据来自数据库，支持筛选与分页。</p>
      <ShipmentsTable />
    </div>
  );
}
