// ============================================================
// AI 规则生成服务 — DeepSeek API 调用（头表+明细）
// ============================================================

import type { ParseRuleConfig, ConfidenceLevel } from "./rule-types";
import { HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS, FIELD_LABELS } from "./order-types";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";
const TIMEOUT_MS = 60000;

export interface GenerateRuleRequest {
  fileName: string;
  fileFormat: string;
  sheetNames: string[];
  headerPreview: string;
  sampleRows: string;
  totalRows: number;
  totalCols: number;
  textContent?: string;
  detectedColumns?: string[];
  /** 系统扫描提取的KV键值对（供AI参考并可直接采用） */
  extractedKVs?: Record<string, string>;
}

export interface GenerateRuleResponse {
  rule: Partial<ParseRuleConfig>;
  rawResponse: string;
  confidence: Record<string, ConfidenceLevel>;
  reasoning: string;
  tokenUsage?: { promptTokens: number; completionTokens: number };
}

function buildPrompt(req: GenerateRuleRequest): string {
  const headerDesc = HEADER_FIELD_KEYS.map((k) => `  - ${k}: ${FIELD_LABELS[k]}`).join("\n");
  const detailDesc = DETAIL_FIELD_KEYS.map((k) => `  - ${k}: ${FIELD_LABELS[k]}`).join("\n");

  return `你是一个物流出库单解析专家。分析文件结构，生成头表+明细的解析规则。

## 目标字段

### 头表字段（收货信息，每条订单一条）
${headerDesc}

### 明细字段（SKU信息，每条订单可有多条明细）
${detailDesc}

## 字段约束
- 头表：receiverStore（收货门店）或 receiverName+receiverPhone+receiverAddress 二选一必填
- 明细：skuCode、skuName、skuQty 必填
- 同一配送单号/外部编码的多行明细共享头表信息

## 文件信息
- 文件名：${req.fileName}
- 格式：${req.fileFormat}
- Sheet：${req.sheetNames.join(", ")}
- 总行数：${req.totalRows}，总列数：${req.totalCols}
${req.detectedColumns?.length ? `- 检测到的列名：${req.detectedColumns.join("、")}` : ""}
${req.extractedKVs && Object.keys(req.extractedKVs).length > 0
  ? `- 系统扫描提取的头表键值对：${Object.entries(req.extractedKVs).map(([k,v]) => `${k}=${v}`).join(", ")}。请分析这些键值对，将合适的值填入 headerColumns 映射中。`
  : ""}

## 数据预览（前几行）
${req.headerPreview}

## 样例数据行
${req.sampleRows}

${req.textContent ? `## 纯文本内容\n${req.textContent.slice(0, 3000)}\n` : ""}

## 任务
请返回一条 JSON 解析规则。格式如下（必须严格按此结构）：

\`\`\`json
{
  "name": "规则名称",
  "region": {
    "headerSkipRows": 0,
    "headerRow": 0,
    "footerSkipRows": 0,
    "dataStartRow": null,
    "mergeSheets": false,
    "sheetFilter": null,
    "cardDetection": null
  },
  "headerColumns": {
    "externalCode": "源列名",
    "receiverStore": "源列名",
    ...
  },
  "detailColumns": {
    "skuCode": "源列名",
    "skuName": "源列名",
    "skuQty": "源列名",
    "skuSpec": "源列名"
  },
  "headerGroupBy": "externalCode",
  "transform": {
    "type": "none"
  },
  "footer": [],
  "defaults": {}
}
\`\`\`

重要：
- headerColumns/detailColumns 中的"源列名"必须使用数据预览中实际出现的列名原文（包括中英文）
- 未匹配到的字段不要包含在该映射中
- headerGroupBy 为分组依据字段（通常是 externalCode 或 receiverStore）
- transform.type 从 none, matrix_transpose, cross_row_aggregate, card_split, composite_cell_split, text_parse 中选择

只返回 JSON，不要其他文字。`;
}

async function getApiKey(): Promise<string> {
  // 优先从数据库读取
  try {
    const { prisma } = await import("./db");
    const setting = await prisma.appSetting.findUnique({ where: { key: "deepseek_api_key" } });
    if (setting?.value && setting.value.length > 10) return setting.value;
  } catch { /* DB不可用则fallback */ }
  // 回退到环境变量
  return process.env.DEEPSEEK_API_KEY ?? "";
}

export async function generateRule(req: GenerateRuleRequest): Promise<GenerateRuleResponse> {
  const apiKey = await getApiKey();
  if (!apiKey || apiKey === "your-deepseek-api-key-here" || apiKey.length < 10) {
    throw new Error("未配置有效的 API Key，请在页面右上角「设置」中填写 DeepSeek API Key");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: "你是物流数据解析专家，只返回JSON格式的规则配置，不包含其他文字。" },
          { role: "user", content: buildPrompt(req) },
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`DeepSeek API 错误 (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const rawResponse = data.choices?.[0]?.message?.content ?? "";
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 未返回有效的 JSON 规则");

    const rule = JSON.parse(jsonMatch[0]) as Partial<ParseRuleConfig>;
    rule.fileFormat = req.fileFormat as ParseRuleConfig["fileFormat"];
    rule.aiMetadata = {
      generated: true,
      model: DEFAULT_MODEL,
      confidence: evaluateConfidence(rule, req),
    };

    return {
      rule,
      rawResponse,
      confidence: rule.aiMetadata.confidence ?? {},
      reasoning: `AI 分析了 ${req.fileFormat} 文件（${req.totalRows}行×${req.totalCols}列），自动匹配了 ${
        Object.keys(rule.headerColumns || {}).length
      } 个头表字段和 ${
        Object.keys(rule.detailColumns || {}).length
      } 个明细字段`,
      tokenUsage: data.usage
        ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
        : undefined,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function evaluateConfidence(rule: Partial<ParseRuleConfig>, req: GenerateRuleRequest): Record<string, ConfidenceLevel> {
  const confidence: Record<string, ConfidenceLevel> = {};
  const allText = (req.headerPreview + req.sampleRows).toLowerCase();
  const allCols = { ...rule.headerColumns, ...rule.detailColumns };

  for (const key of [...HEADER_FIELD_KEYS, ...DETAIL_FIELD_KEYS]) {
    if (allCols[key]) {
      confidence[key] = allText.includes(String(allCols[key]).toLowerCase()) ? "high" : "medium";
    } else {
      confidence[key] = "low";
    }
  }
  return confidence;
}
