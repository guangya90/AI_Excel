import { ImportFlow } from "@/components/ImportFlow";

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">导入下单</h1>
      <p className="text-sm text-gray-500">
        上传文件 → 智能分析列名 → 配置头表/明细映射 → 预览校验 → 提交入库
      </p>
      <ImportFlow />
    </div>
  );
}
