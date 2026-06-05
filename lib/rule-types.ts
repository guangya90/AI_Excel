// ============================================================
// 规则引擎完整类型体系 — 万能导入 V2
// ============================================================

/** 支持的变换类型 */
export type TransformType =
  | "none"                    // 标准行列映射，无需变换
  | "matrix_transpose"        // 矩阵转置：列头 → 行记录
  | "cross_row_aggregate"     // 跨行聚合：按分组键合并多行收货信息
  | "card_split"              // 卡片拆分：识别卡片边界逐块解析
  | "composite_cell_split"    // 复合单元格拆分：单元格内多行文本 → 多行数据
  | "text_parse";             // 纯文本解析：从段落文本提取字段

/** AI 生成的置信度标注 */
export type ConfidenceLevel = "high" | "medium" | "low";

/** 尾部信息提取规则 */
export interface FooterRule {
  /** 目标系统字段 */
  field: string;
  /** 匹配模式（正则或关键词） */
  pattern: string;
  /** 值相对于匹配行的偏移（0=同一行，1=下一行，-1=上一行） */
  offset?: number;
}

/** 卡片识别配置 */
export interface CardConfig {
  /** 卡片起始标记（正则或关键词） */
  startMarker: string;
  /** 卡片结束标记（可选，默认遇到下一个startMarker或文档结束） */
  endMarker?: string;
  /** 卡片内字段在表格前的行位置（{ "receiverStore": 2, "receiverPhone": 4 }） */
  fieldsBeforeTable?: Record<string, number>;
  /** 表格起始行偏移（相对于卡片起始行） */
  tableStartOffset?: number;
}

/** 复合单元格拆分配置 */
export interface CompositeCellConfig {
  /** 单元格内分隔符 */
  separator: string;
  /** 列名映射（cellValue → 多字段） */
  columnMapping?: Record<string, string>;
  /** 拆分模式：split = 拆多行, assign = 拆多列 */
  mode: "split" | "assign";
}

/** 跨行聚合配置 */
export interface CrossRowAggregateConfig {
  /** 分组键字段名（如"配送单号"） */
  groupByField: string;
  /** 需要聚合的共享字段列表 */
  sharedFields: string[];
}

/** 矩阵转置配置 */
export interface MatrixTransposeConfig {
  /** 转置轴的列头起始位置 */
  pivotColumnStart: number;
  /** 转置轴标签映射到的目标字段 */
  pivotField: string;
  /** 值所在的维度字段映射 */
  valueFieldMapping?: Record<string, string>;
}

/** 文本解析配置 */
export interface TextParseConfig {
  /** 记录分隔符 */
  recordSeparator: string;
  /** 字段行正则模式 */
  fieldPatterns: Record<string, string>;
  /** 物品行正则模式 */
  itemPattern: string;
}

/** 区域配置 */
export interface RegionConfig {
  /** 指定 Sheet 名过滤（多Sheet时） */
  sheetFilter?: string;
  /** 表头前跳过行数 */
  headerSkipRows: number;
  /** 表头所在行（0-based） */
  headerRow: number;
  /** 数据区结束前跳过的尾部行数 */
  footerSkipRows?: number;
  /** 数据起始行（若不自动推断） */
  dataStartRow?: number;
  /** 数据结束行 */
  dataEndRow?: number;
  /** 是否合并所有 Sheet */
  mergeSheets?: boolean;
  /** 卡片检测配置 */
  cardDetection?: CardConfig;
  /** 头表字段布局：vertical=列头在顶部行, horizontal=键值对横向排列, both=两者都检测 */
  headerLayout?: "vertical" | "horizontal" | "both";
  /** 是否从尾部提取头表字段（如底部备注中的收货信息） */
  extractFooterHeader?: boolean;
}

/** 变换配置（联合类型） */
export interface TransformConfig {
  type: TransformType;
  config?:
    | MatrixTransposeConfig
    | CrossRowAggregateConfig
    | CardConfig
    | CompositeCellConfig
    | TextParseConfig;
}

/** 列映射：systemField → sourceColumnName */
export type ColumnMapping = Record<string, string>;

/** 默认值：systemField → defaultValue */
export type DefaultValues = Record<string, string>;

/** AI 元数据 */
export interface AIMetadata {
  generated: boolean;
  model?: string;
  /** 逐字段置信度标注 */
  confidence?: Record<string, ConfidenceLevel>;
  /** AI 生成的原始 Prompt */
  promptTokenCount?: number;
}

// ============================================================
// 解析规则核心配置
// ============================================================
export interface ParseRuleConfig {
  id?: string;
  name: string;
  description?: string;
  /** 适用文件格式 */
  fileFormat: "xlsx" | "xls" | "docx" | "pdf";

  /** 区域识别配置 */
  region: RegionConfig;

  /** 头表列映射：headerSystemField → sourceColumnName */
  headerColumns: ColumnMapping;

  /** 明细列映射：detailSystemField → sourceColumnName */
  detailColumns: ColumnMapping;

  /** 头表分组键（多行明细归属到同一头表的依据字段，如"外部编码"） */
  headerGroupBy?: string;

  /** 变换类型与配置 */
  transform: TransformConfig;

  /** 尾部信息提取规则 */
  footer?: FooterRule[];

  /** 静态默认值 */
  defaults?: DefaultValues;

  /** AI 元数据（AI生成时附带） */
  aiMetadata?: AIMetadata;
}

// ============================================================
// 解析文档抽象（统一输入格式）
// ============================================================

/** 标准化单元格 */
export interface CellValue {
  value: string | number;
  row: number;
  col: number;
  colName?: string;
}

/** 标准化行 */
export type ParsedRow = CellValue[];

/** 标准化表格/Sheet */
export interface ParsedTable {
  sheetName: string;
  headers: string[];
  rows: ParsedRow[];
  /** 原始矩阵（用于直接索引访问） */
  rawMatrix?: (string | number | undefined)[][];
  /** 从全表扫描出的头表键值对（左右结构提取） */
  headerKVPairs?: Record<string, string>;
}

/** 文本段落 */
export interface TextBlock {
  text: string;
  lineIndex: number;
  pageIndex?: number;
}

/** 统一解析文档 */
export interface ParsedDocument {
  sourceName: string;
  sourceFormat: "xlsx" | "xls" | "docx" | "pdf";
  /** 表格数据（Excel/PDF表格） */
  tables: ParsedTable[];
  /** 文本段落（Word/PDF纯文本） */
  textBlocks?: TextBlock[];
  /** 原始文件内容（用于解析失败展示） */
  rawContent?: string;
  /** 总行数 */
  totalRows: number;
  /** 解析警告 */
  warnings: string[];
}

// ============================================================
// 规则引擎执行结果
// ============================================================
export interface RuleEngineResult {
  rows: Record<string, string>[];
  warnings: string[];
  stats: {
    totalRows: number;
    parsedRows: number;
    skippedRows: number;
    footerExtracted: boolean;
  };
}

// ============================================================
// 规则引擎执行结果（扩展版，供外部使用）
// ============================================================
export interface RuleExecutionOutput {
  success: boolean;
  rows: Record<string, string>[];
  errors: string[];
  warnings: string[];
  stats: RuleEngineResult["stats"];
}

// ============================================================
// 头表+明细 执行结果
// ============================================================

/** 一组订单执行结果 */
export interface OrderGroupResult {
  header: Record<string, string>;
  details: Record<string, string>[];
}

export interface HeaderDetailExecutionOutput {
  success: boolean;
  groups: OrderGroupResult[];
  errors: string[];
  warnings: string[];
  stats: {
    totalRows: number;
    groupsCount: number;
    detailsCount: number;
    skippedRows: number;
    footerExtracted: boolean;
    ambiguousRowCount: number;
  };
}
