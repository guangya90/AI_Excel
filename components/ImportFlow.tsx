"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { ProgressBar } from "@/components/ProgressBar";
import { OrdersGrid } from "@/components/OrdersGrid";
import RuleSelector from "@/components/RuleSelector";
import RuleEditor from "@/components/RuleEditor";
import AIPanel from "@/components/AIPanel";
import RuleTestPreview from "@/components/RuleTestPreview";
import { parseFile } from "@/lib/file-parser";
import { executeRuleHD } from "@/lib/rule-engine";
import { exportGroupsToXlsx } from "@/lib/excel-utils";
import { autoMapColumns, type ColumnAnalysis } from "@/lib/column-mapping";
import type { OrderFieldKey, OrderRowDraft, HeaderDraft, DetailDraft, OrderGroup, HeaderFieldKey, DetailFieldKey } from "@/lib/order-types";
import { emptyHeaderDraft, emptyDetailDraft, HEADER_FIELD_KEYS, DETAIL_FIELD_KEYS, FIELD_LABELS } from "@/lib/order-types";
import type { ParseRuleConfig, ParsedDocument } from "@/lib/rule-types";
import { validateGroups, mergeDbExternalDuplicateMessages, type BatchValidation } from "@/lib/order-rows";
import type { GenerateRuleResponse } from "@/lib/ai-rule-generator";

type Step = "upload" | "rule-select" | "rule-edit" | "preview" | "submit";

async function sleep(ms: number): Promise<void> { await new Promise((r) => setTimeout(r, ms)); }

export function ImportFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [importPct, setImportPct] = useState(0);
  const [importLabel, setImportLabel] = useState("");
  const [submitPct, setSubmitPct] = useState(0);
  const [submitLabel, setSubmitLabel] = useState("");

  // 文件
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    fileName: string; fileFormat: string; sheetNames: string[];
    headerPreview: string; sampleRows: string; totalRows: number; totalCols: number; textContent?: string;
    extractedKVs?: Record<string, string>;
  } | null>(null);
  const [columnAnalysis, setColumnAnalysis] = useState<ColumnAnalysis | null>(null);

  // 规则
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [ruleConfig, setRuleConfig] = useState<Partial<ParseRuleConfig>>({});
  const [aiConfidence, setAiConfidence] = useState<Record<string, "high" | "medium" | "low">>();
  const [savedRuleId, setSavedRuleId] = useState<string | null>(null);

  // 数据
  const [groups, setGroups] = useState<OrderGroup[]>([]);
  const [flatRows, setFlatRows] = useState<OrderRowDraft[]>([]);
  const [validation, setValidation] = useState<BatchValidation>({ rowFieldErrors: new Map(), list: [], duplicateExternalRows: new Map() });
  const [remoteChecking, setRemoteChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFlow = useCallback(() => {
    setStep("upload"); setImportPct(0); setImportLabel(""); setSubmitPct(0); setSubmitLabel("");
    setCurrentFile(null); setDocument(null); setFileInfo(null); setColumnAnalysis(null);
    setSelectedRuleId(null); setRuleConfig({}); setSavedRuleId(null); setAiConfidence(undefined);
    setGroups([]); setFlatRows([]);
    setValidation({ rowFieldErrors: new Map(), list: [], duplicateExternalRows: new Map() });
  }, []);

  // 每次进入页面时重置
  useEffect(() => { resetFlow(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ===== 校验 =====
  const runValidation = useCallback(async (nextFlatRows: OrderRowDraft[]) => {
    const base = validateGroups(groups);
    const pairs = nextFlatRows
      .map((r, i) => ({ row: i + 1, code: (r.externalCode || "").trim() }))
      .filter((p) => p.code.length > 0);
    if (pairs.length === 0) { setRemoteChecking(false); setValidation(base); return; }
    setRemoteChecking(true);
    try {
      const res = await fetch("/api/orders/check-externals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pairs }) });
      if (!res.ok) { setValidation(base); return; }
      const data = await res.json() as { dbHits: { code: string; rows: number[] }[] };
      const m = new Map<string, number[]>();
      for (const h of data.dbHits) m.set(h.code, h.rows);
      setValidation(mergeDbExternalDuplicateMessages(base, m));
    } catch { setValidation(base); } finally { setRemoteChecking(false); }
  }, [groups]);

  useEffect(() => {
    if (step !== "preview") return;
    if (validationTimer.current) clearTimeout(validationTimer.current);
    if (groups.length > 0) {
      validationTimer.current = setTimeout(() => { void runValidation(flatRows); }, 400);
    }
    return () => { if (validationTimer.current) clearTimeout(validationTimer.current); };
  }, [groups, flatRows, step, runValidation]);

  const sortedErrors = useMemo(
    () => [...validation.list].sort((a, b) => a.row - b.row || a.field.localeCompare(b.field)), [validation.list]);
  const hasErrors = validation.rowFieldErrors.size > 0;

  // ===== 步骤1: 文件上传 → 分析列名 =====
  const onFileUpload = async (file: File) => {
    setBusy(true); setImportPct(0); setImportLabel("读取文件..."); setCurrentFile(file);
    try {
      setImportPct(30); await sleep(0);
      setImportLabel("解析文档结构...");
      const result = await parseFile(file);
      setDocument(result.document);
      setFileInfo(result.aiSummary);

      // 自动分析列名
      const headers = result.document.tables[0]?.headers || [];
      const { headerMapping, detailMapping, columnAnalysis: analysis } = autoMapColumns(headers);
      setColumnAnalysis(analysis);

      // 从提取的KV中构建默认值（仅系统字段键）
      const kvDefaults: Record<string, string> = {};
      const kvPairs = result.document.tables[0]?.headerKVPairs || {};
      for (const k of HEADER_FIELD_KEYS) {
        if (kvPairs[k]) kvDefaults[k] = kvPairs[k];
      }

      // 预填规则（头表列映射仅来自表头，提取的KV值放入 defaults）
      setRuleConfig({
        name: file.name.replace(/\.[^.]+$/, ""),
        fileFormat: result.document.sourceFormat,
        region: { headerSkipRows: 0, headerRow: 0 },
        headerColumns: headerMapping as Record<string, string>,
        detailColumns: detailMapping as Record<string, string>,
        headerGroupBy: "externalCode",
        transform: { type: "none" },
        footer: [],
        defaults: kvDefaults,
      });

      setImportPct(100); setImportLabel("完成");
      setStep("rule-select");

      const matchedHeader = Object.keys(headerMapping).length;
      const matchedDetail = Object.keys(detailMapping).length;
      const unmatched = analysis.unmatched.length;
      toast.success(
        `已解析「${file.name}」：自动匹配 ${matchedHeader} 个头表字段 + ${matchedDetail} 个明细字段` +
        (unmatched > 0 ? `（${unmatched} 列未匹配）` : ""),
        { duration: 4000 },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "文件解析失败");
      setCurrentFile(null);
    } finally {
      setBusy(false); setTimeout(() => setImportPct(0), 800);
    }
  };

  // ===== 步骤2: 选择已有规则 =====
  const onSelectRule = async (ruleId: string) => {
    setSelectedRuleId(ruleId); setBusy(true);
    try {
      const res = await fetch(`/api/rules/${ruleId}`);
      if (!res.ok) { toast.error("加载规则失败"); return; }
      const data = await res.json();
      const loadedRule: ParseRuleConfig = {
        ...(data.config as unknown as ParseRuleConfig),
        id: data.id, name: data.name, description: data.description, fileFormat: data.fileFormat,
      };
      // 兼容旧规则：如果没有 headerColumns/detailColumns
      if (!loadedRule.headerColumns) loadedRule.headerColumns = {};
      if (!loadedRule.detailColumns) loadedRule.detailColumns = {};
      if (!loadedRule.headerGroupBy) loadedRule.headerGroupBy = "externalCode";

      setRuleConfig(loadedRule);
      setSavedRuleId(ruleId);
      toast.success(`已加载规则「${data.name}」`);

      if (!document) return;
      const result = executeRuleHD(document, loadedRule);
      if (result.success && result.groups.length > 0) {
        updateGroupsAndRows(result.groups);
        setStep("preview");
        toast.success(`解析完成：${result.stats.groupsCount} 组订单，${result.stats.detailsCount} 条明细`);
      } else {
        toast.error(result.errors[0] || "规则执行失败，请检查映射配置");
      }
    } catch { toast.error("读取规则失败"); } finally { setBusy(false); }
  };

  const onCreateNewRule = () => {
    setSelectedRuleId(null); setSavedRuleId(null);
    setStep("rule-edit");
  };

  // ===== AI 生成规则回调 =====
  const onAiRuleGenerated = (result: GenerateRuleResponse) => {
    setRuleConfig((prev) => {
      const merged = { ...prev, ...result.rule };
      // 确保必备字段存在
      if (!merged.headerColumns) merged.headerColumns = {};
      if (!merged.detailColumns) merged.detailColumns = {};
      if (!merged.headerGroupBy) merged.headerGroupBy = "externalCode";
      return merged;
    });
    setAiConfidence(result.confidence);
    toast.success("AI 已生成推荐规则，请确认并微调后保存");
  };

  const updateGroupsAndRows = (hdGroups: { header: Record<string, string>; details: Record<string, string>[] }[]) => {
    const orderGroups: OrderGroup[] = hdGroups.map((g) => ({
      id: crypto.randomUUID(),
      header: Object.fromEntries(HEADER_FIELD_KEYS.map((k) => [k, g.header[k] || ""])) as unknown as HeaderDraft,
      details: g.details.map((d) =>
        Object.fromEntries(DETAIL_FIELD_KEYS.map((k) => [k, d[k] || ""])) as unknown as DetailDraft,
      ),
    }));
    setGroups(orderGroups);
    setFlatRows(orderGroups.flatMap((g) =>
      g.details.map((d) => ({ ...g.header, ...d } as OrderRowDraft)),
    ));
  };

  // ===== 步骤3: 保存规则并预览 =====
  const onSaveRuleAndPreview = async () => {
    if (!document || !ruleConfig.name) { toast.error("请完善规则配置"); return; }
    setBusy(true);
    try {
      let ruleId = savedRuleId;
      const body = { name: ruleConfig.name, description: ruleConfig.description, fileFormat: ruleConfig.fileFormat, config: ruleConfig };
      if (ruleId) {
        await fetch(`/api/rules/${ruleId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        const res = await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.rule?.id) { ruleId = data.rule.id; setSavedRuleId(ruleId); }
      }
      toast.success("规则已保存");

      const result = executeRuleHD(document, ruleConfig as ParseRuleConfig);
      if (result.success && result.groups.length > 0) {
        updateGroupsAndRows(result.groups);
        setStep("preview");
        toast.success(`解析完成：${result.stats.groupsCount} 组订单，${result.stats.detailsCount} 条明细`);
      } else {
        toast.error(result.errors[0] || "规则执行失败，请检查列映射");
      }
    } catch { toast.error("保存规则失败"); } finally { setBusy(false); }
  };

  // ===== 预览编辑 =====
  const updateHeaderCell = (gi: number, field: HeaderFieldKey, value: string) => {
    setGroups((prev) => { const n = [...prev]; n[gi] = { ...n[gi], header: { ...n[gi].header, [field]: value } }; return n; });
  };
  const updateDetailCell = (gi: number, di: number, field: DetailFieldKey, value: string) => {
    setGroups((prev) => {
      const n = [...prev]; const details = [...n[gi].details]; details[di] = { ...details[di], [field]: value };
      n[gi] = { ...n[gi], details }; return n;
    });
  };
  const addDetailRow = (gi: number) => {
    setGroups((prev) => { const n = [...prev]; n[gi] = { ...n[gi], details: [...n[gi].details, emptyDetailDraft()] }; return n; });
  };
  const deleteDetailRow = (gi: number, di: number) => {
    setGroups((prev) => { const n = [...prev]; n[gi] = { ...n[gi], details: n[gi].details.filter((_, i) => i !== di) }; return n; });
  };
  const addGroup = () => {
    setGroups((prev) => [...prev, { id: crypto.randomUUID(), header: emptyHeaderDraft(), details: [emptyDetailDraft()] }]);
  };
  const deleteGroup = (gi: number) => setGroups((prev) => prev.filter((_, i) => i !== gi));
  const exportXlsx = () => { try { exportGroupsToXlsx(groups, `导入预览_${Date.now()}.xlsx`); toast.success("已导出 Excel"); } catch { toast.error("导出失败"); } };

  // ===== 提交 =====
  const submitAll = async () => {
    if (hasErrors) { toast.error("存在校验错误，请先修正。"); return; }
    if (groups.length === 0) { toast.error("没有可提交的数据"); return; }
    setSubmitting(true); setSubmitPct(0); setSubmitLabel("准备提交...");
    const batchId = crypto.randomUUID();
    const payload = {
      batchId,
      groups: groups.map((g) => ({
        header: {
          externalCode: (g.header.externalCode || "").trim() || undefined,
          receiverStore: (g.header.receiverStore || "").trim() || undefined,
          receiverName: (g.header.receiverName || "").trim() || undefined,
          receiverPhone: (g.header.receiverPhone || "").replace(/\s/g, "") || undefined,
          receiverAddress: (g.header.receiverAddress || "").trim() || undefined,
          remark: (g.header.remark || "").trim() || undefined,
        },
        details: g.details.map((d) => ({
          skuCode: d.skuCode, skuName: d.skuName,
          skuQty: Number(String(d.skuQty).replace(/[^0-9]/g, "")) || 1,
          skuSpec: d.skuSpec.trim() || undefined,
        })),
      })),
    };

    setSubmitLabel(`提交中 (共 ${groups.length} 组)`); setSubmitPct(50);
    try {
      const res = await fetch("/api/orders/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({})) as { success?: number; failed?: number; error?: string };
      if (!res.ok) { toast.error(data.error ?? "提交失败"); return; }
      setSubmitPct(100); setSubmitLabel("完成");
      toast.success(`提交完成：成功 ${data.success ?? 0} 组${(data.failed ?? 0) > 0 ? `，失败 ${data.failed} 组` : ""}`);
      if ((data.success ?? 0) > 0) resetFlow();
    } catch { toast.error("网络错误"); } finally {
      setSubmitting(false); setTimeout(() => { setSubmitPct(0); setSubmitLabel(""); }, 1200);
    }
  };

  // ===== 步骤指示器 =====
  const steps = [
    { key: "upload" as Step, label: "上传文件" },
    { key: "rule-select" as Step, label: "选择规则" },
    { key: "rule-edit" as Step, label: "配置规则" },
    { key: "preview" as Step, label: "预览数据" },
  ];
  const curIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center gap-1 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition ${
              i <= curIdx ? "bg-[#e8fafa] text-[#0fc6c2]" : "bg-gray-50 text-gray-400"
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                i < curIdx ? "bg-[#0fc6c2] text-white" : i === curIdx ? "bg-[#0fc6c2] text-white" : "bg-gray-200 text-gray-500"
              }`}>{i < curIdx ? "✓" : i + 1}</span>
              {s.label}
            </div>
            {i < steps.length - 1 && <div className={`w-8 h-px ${i < curIdx ? "bg-[#0fc6c2]" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* 步骤1: 上传 */}
      {step === "upload" && (
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">上传出库单文件</h2>
          <p className="text-sm text-gray-500 mb-4">支持 Excel、Word、PDF。上传后自动分析表头，智能匹配头表/明细列名</p>
          <FileDropzone disabled={busy || submitting} onFile={(f) => { void onFileUpload(f); }} onError={(m) => toast.error(m)} />
          {importPct > 0 && <div className="mt-4"><ProgressBar value={importPct} label="解析进度" subLabel={importLabel} /></div>}
          {currentFile && (
            <div className="mt-4 flex items-center gap-3 bg-[#e8fafa] rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-[#0fc6c2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-700 font-medium">{currentFile.name}</span>
            </div>
          )}
        </section>
      )}

      {/* 步骤2: 选择/新建规则 + 列分析展示 */}
      {step === "rule-select" && (
        <section className="space-y-4">
          {/* 列分析结果卡片 */}
          {columnAnalysis && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                智能列名分析结果
                <span className="ml-2 text-xs text-gray-400 font-normal">
                  （系统自动匹配，可直接使用或后续手动调整）
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* 头表匹配 */}
                <div className="bg-blue-50/50 rounded-xl p-3">
                  <p className="font-medium text-blue-600 mb-2">头表字段（已匹配 {Object.keys(columnAnalysis.headerMapping).length}/{HEADER_FIELD_KEYS.length}）</p>
                  <div className="space-y-1">
                    {HEADER_FIELD_KEYS.map((k) => {
                      const match = columnAnalysis.headerMapping[k as HeaderFieldKey];
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-gray-500 w-20">{FIELD_LABELS[k]}</span>
                          <span className="text-gray-300">→</span>
                          {match ? (
                            <span className="text-blue-700 font-medium">{match.col}</span>
                          ) : (
                            <span className="text-gray-400 italic">未匹配</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 明细匹配 */}
                <div className="bg-green-50/50 rounded-xl p-3">
                  <p className="font-medium text-green-600 mb-2">
                    明细字段（已匹配 {Object.keys(columnAnalysis.detailMapping).length}/{DETAIL_FIELD_KEYS.length}）
                    {columnAnalysis.missingRequired.length > 0 && (
                      <span className="text-red-400 ml-1">⚠ 缺必填项</span>
                    )}
                  </p>
                  <div className="space-y-1">
                    {DETAIL_FIELD_KEYS.map((k) => {
                      const match = columnAnalysis.detailMapping[k as DetailFieldKey];
                      return (
                        <div key={k} className="flex items-center gap-2">
                          <span className="text-gray-500 w-20">{FIELD_LABELS[k]}</span>
                          <span className="text-gray-300">→</span>
                          {match ? (
                            <span className="text-green-700 font-medium">{match.col}</span>
                          ) : (
                            <span className="text-red-400 italic flex items-center gap-1">
                              <span>未匹配</span>
                              {["skuCode","skuName","skuQty"].includes(k) && <span className="text-red-500">*必填</span>}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 未匹配列 */}
              {columnAnalysis.unmatched.length > 0 && (
                <div className="mt-3 p-2.5 bg-yellow-50 rounded-xl border border-yellow-100">
                  <p className="text-xs text-yellow-700">
                    <span className="font-medium">未识别列名：</span>
                    {columnAnalysis.unmatched.join("、")}
                    <span className="text-yellow-500 ml-1">（可在下一步手动映射）</span>
                  </p>
                </div>
              )}

              {/* 提取到的水平布局头表键值对（如底部/顶部的收货人、单据号等） */}
              {fileInfo?.extractedKVs && Object.keys(fileInfo.extractedKVs).length > 0 && (
                <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                  <p className="text-xs font-medium text-purple-600 mb-2">
                    智能提取的头表字段（上下/左右结构扫描）
                  </p>
                  <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                    {Object.entries(fileInfo.extractedKVs).map(([k, v]) => (
                      <div key={k} className="flex items-baseline gap-1.5">
                        <span className="text-purple-500 font-medium shrink-0">{k}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-purple-700 truncate" title={v}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-purple-400 mt-2">这些字段将自动填入每条订单的头表信息</p>
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">选择解析规则</h2>
                <p className="text-sm text-gray-500">选择已有规则或创建新规则。新建可手动配置或由 AI 辅助生成</p>
              </div>
              <button onClick={() => { setStep("upload"); setCurrentFile(null); }} className="text-sm text-gray-400 hover:text-gray-600">重新上传</button>
            </div>
            <RuleSelector onSelect={(id) => { void onSelectRule(id); }} onCreateNew={onCreateNewRule} />
          </div>
        </section>
      )}

      {/* 步骤3: 配置规则（AI + 手动） */}
      {step === "rule-edit" && (
        <section className="space-y-6">
          {/* AI 面板 */}
          <AIPanel
            fileInfo={fileInfo}
            detectedColumns={(() => {
              if (!columnAnalysis) return [];
              const cols: string[] = [];
              for (const v of Object.values(columnAnalysis.headerMapping || {})) {
                if (v && v.col) cols.push(v.col);
              }
              for (const v of Object.values(columnAnalysis.detailMapping || {})) {
                if (v && v.col) cols.push(v.col);
              }
              return cols;
            })()}
            onRuleGenerated={onAiRuleGenerated}
          />

          {/* 手动编辑 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">配置解析规则</h2>
            <p className="text-sm text-gray-400 mb-4">
              {aiConfidence ? "AI 已生成规则，请确认并微调" : "系统已自动匹配列名，可手动调整"}
            </p>
            <RuleEditor
              rule={ruleConfig}
              onChange={setRuleConfig}
              confidence={aiConfidence}
              availableColumns={document?.tables[0]?.headers}
            />
          </div>

          {/* 试解析 */}
          <RuleTestPreview rule={ruleConfig} document={document} onConfirm={onSaveRuleAndPreview} />

          <div className="flex gap-3 justify-end">
            <button onClick={() => setStep("rule-select")}
              className="px-4 py-2 border border-gray-200 text-sm rounded-lg text-gray-600 hover:bg-gray-50">返回选择规则</button>
            <button onClick={() => { void onSaveRuleAndPreview(); }} disabled={busy || !ruleConfig.name}
              className="px-6 py-2 bg-[#0fc6c2] text-white text-sm font-medium rounded-lg hover:bg-[#0bada9] transition disabled:opacity-50">保存规则并预览</button>
          </div>
        </section>
      )}

      {/* 步骤4: 预览 */}
      {step === "preview" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">数据预览与校验（头表+明细）</h2>
              <p className="text-sm text-gray-500">共 {groups.length} 组订单，{groups.reduce((s,g)=>s+g.details.length,0)} 条明细</p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportXlsx} disabled={busy || submitting} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">导出 Excel</button>
              <button onClick={() => setStep("rule-select")} disabled={submitting} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">重新选择规则</button>
              <button onClick={resetFlow} disabled={submitting} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">重新上传</button>
            </div>
          </div>

          {sortedErrors.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded-xl border border-red-200 bg-red-50 p-4 text-xs">
              <div className="mb-2 font-semibold text-red-600">错误明细（共 {sortedErrors.length} 条）</div>
              <ul className="space-y-1 text-red-500">{sortedErrors.map((e, idx) => <li key={`${e.row}-${e.field}-${idx}`}>{e.message}</li>)}</ul>
            </div>
          ) : remoteChecking ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">正在与数据库比对外部编码...</div>
          ) : groups.length > 0 ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-600 font-medium">✓ 当前批次校验通过</div>
          ) : null}

          <OrdersGrid
            groups={groups}
            rowFieldErrors={validation.rowFieldErrors}
            onUpdateHeader={updateHeaderCell}
            onUpdateDetail={updateDetailCell}
            onAddDetail={addDetailRow}
            onDeleteDetail={deleteDetailRow}
            onAddGroup={addGroup}
            onDeleteGroup={deleteGroup}
          />

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">提交到数据库（头表+明细）</h3>
            {submitPct > 0 && <ProgressBar value={submitPct} label="提交进度" subLabel={submitLabel} />}
            <button type="button" disabled={submitting || busy || hasErrors || groups.length === 0}
              onClick={() => { void submitAll(); }}
              className="w-full rounded-xl bg-gradient-to-r from-[#0fc6c2] to-[#0bada9] px-6 py-3 text-sm font-semibold text-white hover:shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
              {submitting ? "提交中..." : `确认提交（${groups.length} 组订单）`}
            </button>
            {hasErrors && <p className="text-xs text-red-500 text-center">存在未解决的校验错误时无法提交</p>}
          </div>
        </section>
      )}
    </div>
  );
}
