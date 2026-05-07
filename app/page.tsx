import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/40 p-8 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold text-white">万能导入 — 多模板自动导入下单</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          支持 .xlsx / .xls 拖拽上传，自动识别列名同义词与列序变化；可手动映射并记忆模板。在线预览与批量校验后一键写入数据库，并可在运单列表中检索历史记录。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/import"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-blue-600"
          >
            开始导入
          </Link>
          <Link
            href="/shipments"
            className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            查看运单
          </Link>
        </div>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {[
          "多模板自动识别 + 手动映射 + 模板记忆",
          "类 Excel 预览编辑，批量错误列表与外部编码去重提示",
          "导入/提交双进度条，Toast 与防重复提交",
          "运单分页列表，支持外部编码 / 收件人 / 时间筛选",
        ].map((t) => (
          <li
            key={t}
            className="rounded-xl border border-slate-700/60 bg-slate-900/30 px-4 py-3 text-slate-200"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
