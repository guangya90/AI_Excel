# 万能导入 — 多模板自动导入下单系统

Next.js 14（App Router）+ TypeScript + Prisma + PostgreSQL（Neon / Supabase / Vercel Postgres 等）。支持 Excel 多模板列名识别、手动映射与模板记忆、在线预览校验、批量提交与运单列表。

## 本地开发

1. 安装依赖：`npm install`
2. 复制环境变量：将 `.env.example` 复制为 `.env`，填入 `DATABASE_URL`（PostgreSQL 连接串）。
3. 同步数据库结构：`npx prisma db push`
4. 启动：`npm run dev`

## 部署到 Vercel

1. 在 [Vercel](https://vercel.com) 导入本仓库（或连接 Git 提供商）。
2. 在 Vercel 项目 **Environment Variables** 中设置 `DATABASE_URL`（建议在 Vercel Marketplace 集成 **Neon** 或 **Supabase** 自动生成）。
3. **Build Command** 保持默认 `npm run build`（已包含 `prisma generate`）。
4. 首次部署后，对目标数据库执行一次结构同步（任选其一）：
   - 本地指向同一数据库：`npx prisma db push`
   - 或在 CI/本地使用 `prisma migrate` 流程（可按团队规范扩展）。

部署成功后，Vercel 会提供公开访问 URL。

## 公开 Git 仓库

请在本机执行 `git init`、在 GitHub / GitLab 创建仓库并 `git push`，即可得到公开仓库地址（本交付物不包含你的远程仓库令牌）。

## 功能摘要

- 导入：`.xlsx` / `.xls`，拖拽与点击上传，单文件 ≤ 1MB；表头行自动探测（前 6 行）；列同义词与列序自适应；失败时可手动映射并写入 `template_mappings` 供下次复用。
- 预览：表格式编辑、Tab/Enter 切换、批量错误列表、批次内/库内外部编码重复提示、导出当前预览为 Excel、增删行。
- 提交：校验未通过不可提交；分块提交与进度条；结果 Toast；防重复点击。
- 运单列表：分页；按外部编码、收件人姓名、提交时间范围筛选。

## 技术说明

- 校验规则见 `lib/order-types.ts`（手机号 `1[3-9]` 开头 11 位、温层枚举、重量与件数等）。
- API：`/api/template-mapping/sign|resolve|save`、`/api/orders`、`/api/orders/check-externals`、`/api/orders/submit`。
