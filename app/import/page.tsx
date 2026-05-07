import { ImportFlow } from "@/components/ImportFlow";

export default function ImportPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-white">导入下单</h1>
      <p className="text-sm text-slate-400">上传 Excel → 映射/预览 → 批量校验 → 提交写入数据库。</p>
      <ImportFlow />
    </div>
  );
}
