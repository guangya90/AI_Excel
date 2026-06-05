import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-2 bg-[#e8fafa] text-[#0fc6c2] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-[#0fc6c2] animate-pulse" />
          多格式智能解析
        </div>
        <h1 className="text-4xl font-extrabold text-gray-800 mb-4 leading-tight">
          万能导入
          <span className="text-[#0fc6c2]"> · </span>
          智能批量下单
        </h1>
        <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          支持 <strong>Excel</strong>、<strong>Word</strong>、<strong>PDF</strong> 多格式文件拖拽上传，
          通过 <strong>AI 大模型</strong>自动分析文件结构并生成解析规则，零硬编码适配任意格式出库单，
          在线预览编辑、批量校验后一键提交入库。
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            href="/import"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0fc6c2] to-[#0bada9] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            开始导入
          </Link>
          <Link
            href="/rules"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-[#0fc6c2] hover:text-[#0fc6c2] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            规则管理
          </Link>
          <Link
            href="/shipments"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-[#0fc6c2] hover:text-[#0fc6c2] transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            运单列表
          </Link>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            ),
            title: "多格式支持",
            desc: "Excel、Word、PDF 三种格式拖拽上传，智能识别文档结构",
            color: "from-green-50 to-green-100",
          },
          {
            icon: (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ),
            title: "AI 智能解析",
            desc: "DeepSeek 大模型自动分析文件结构，生成推荐解析规则",
            color: "from-purple-50 to-purple-100",
          },
          {
            icon: (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            ),
            title: "在线编辑",
            desc: "类 Excel 可编辑表格，实时校验，错误高亮，支持增删行",
            color: "from-blue-50 to-blue-100",
          },
          {
            icon: (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            ),
            title: "批量下单",
            desc: "一键提交到 PostgreSQL 数据库，分页查看历史运单记录",
            color: "from-orange-50 to-orange-100",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="group bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
          >
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center text-[#0fc6c2] mb-4 group-hover:scale-110 transition`}>
              {card.icon}
            </div>
            <h3 className="font-semibold text-gray-800 mb-2">{card.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* V2 升级亮点 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">V2 核心升级</h2>
        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#e8fafa] flex items-center justify-center mx-auto">
              <span className="text-[#0fc6c2] font-bold">01</span>
            </div>
            <h4 className="font-semibold text-gray-700">规则引擎</h4>
            <p className="text-gray-500">通用 JSON 配置驱动，新增格式零代码适配，告别硬编码 if-else</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#e8fafa] flex items-center justify-center mx-auto">
              <span className="text-[#0fc6c2] font-bold">02</span>
            </div>
            <h4 className="font-semibold text-gray-700">AI 辅助</h4>
            <p className="text-gray-500">DeepSeek 分析文件 → 生成规则 → 用户确认，智能高效</p>
          </div>
          <div className="text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#e8fafa] flex items-center justify-center mx-auto">
              <span className="text-[#0fc6c2] font-bold">03</span>
            </div>
            <h4 className="font-semibold text-gray-700">复杂结构</h4>
            <p className="text-gray-500">矩阵转置/卡片拆分/跨行聚合/复合单元格/纯文本 全覆盖</p>
          </div>
        </div>
      </div>
    </div>
  );
}
