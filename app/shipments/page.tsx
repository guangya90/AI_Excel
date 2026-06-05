import { ShipmentsTable } from "@/components/ShipmentsTable";

export default function ShipmentsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">已导入运单</h1>
      <p className="text-sm text-gray-500">
        数据来自 PostgreSQL 数据库，支持按外部编码、收货门店、收件人姓名和时间范围筛选。
      </p>
      <ShipmentsTable />
    </div>
  );
}
