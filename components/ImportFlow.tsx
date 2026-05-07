"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { ProgressBar } from "@/components/ProgressBar";
import { ColumnMapper } from "@/components/ColumnMapper";
import { OrdersGrid } from "@/components/OrdersGrid";
import { autoMapColumns, isCompleteMapping } from "@/lib/column-mapping";
import {
  MAX_FILE_BYTES,
  detectHeaderAndRows,
  exportDraftRowsToXlsx,
  parseWorkbookBuffer,
} from "@/lib/excel-utils";
import type { OrderFieldKey, OrderRowDraft } from "@/lib/order-types";
import { emptyDraftRow } from "@/lib/order-types";
import {
  buildDraftRowsFromMatrix,
  mergeDbExternalDuplicateMessages,
  validateBatchRows,
  type BatchValidation,
} from "@/lib/order-rows";

type Step = "upload" | "mapping" | "preview";

const SUBMIT_CHUNK = 45;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export function ImportFlow() {
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [importPct, setImportPct] = useState(0);
  const [importLabel, setImportLabel] = useState("");
  const [submitPct, setSubmitPct] = useState(0);
  const [submitLabel, setSubmitLabel] = useState("");

  const [matrixHeaders, setMatrixHeaders] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [rawDataRows, setRawDataRows] = useState<(string | number | undefined)[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<OrderFieldKey, string>>>({});
  const [signature, setSignature] = useState<string | null>(null);
  const [rows, setRows] = useState<OrderRowDraft[]>([]);
  const [validation, setValidation] = useState<BatchValidation>({
    rowFieldErrors: new Map(),
    list: [],
    duplicateExternalRows: new Map(),
  });

  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFlow = useCallback(() => {
    setStep("upload");
    setImportPct(0);
    setImportLabel("");
    setSubmitPct(0);
    setSubmitLabel("");
    setMatrixHeaders([]);
    setHeaderRowIndex(0);
    setRawDataRows([]);
    setMapping({});
    setSignature(null);
    setRows([]);
    setValidation({
      rowFieldErrors: new Map(),
      list: [],
      duplicateExternalRows: new Map(),
    });
  }, []);

  const runValidation = useCallback(async (nextRows: OrderRowDraft[]) => {
    const base = validateBatchRows(nextRows);
    const pairs = nextRows
      .map((r, i) => ({ row: i + 1, code: r.externalCode.trim() }))
      .filter((p) => p.code.length > 0);

    if (pairs.length === 0) {
      setValidation(base);
      return;
    }

    try {
      const res = await fetch("/api/orders/check-externals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairs }),
      });
      if (!res.ok) {
        setValidation(base);
        return;
      }
      const data = (await res.json()) as {
        dbHits: { code: string; rows: number[] }[];
      };
      const m = new Map<string, number[]>();
      for (const h of data.dbHits) {
        m.set(h.code, h.rows);
      }
      setValidation(mergeDbExternalDuplicateMessages(base, m));
    } catch {
      setValidation(base);
    }
  }, []);

  useEffect(() => {
    if (step !== "preview") return;
    if (validationTimer.current) clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(() => {
      void runValidation(rows);
    }, 400);
    return () => {
      if (validationTimer.current) clearTimeout(validationTimer.current);
    };
  }, [rows, step, runValidation]);

  const sortedErrors = useMemo(() => {
    return [...validation.list].sort((a, b) => a.row - b.row || a.field.localeCompare(b.field));
  }, [validation.list]);

  const hasErrors = validation.rowFieldErrors.size > 0;

  const processFile = async (file: File) => {
    setBusy(true);
    setImportPct(0);
    setImportLabel("读取文件…");
    try {
      const buf = await file.arrayBuffer();
      setImportPct(15);
      await sleep(0);
      setImportLabel("解析工作表…");
      const parsed = parseWorkbookBuffer(buf);
      if (!parsed.ok) {
        toast.error(parsed.message);
        return;
      }
      setImportPct(45);
      const detected = detectHeaderAndRows(parsed.matrix);
      if (!detected) {
        toast.error("无法识别表头行，请检查前几行是否包含列名。");
        return;
      }
      setImportPct(65);
      setImportLabel("匹配模板与列映射…");
      const auto = autoMapColumns(detected.headers);
      setMatrixHeaders(detected.headers);
      setHeaderRowIndex(detected.headerRowIndex);
      setRawDataRows(detected.dataRows);

      const signRes = await fetch("/api/template-mapping/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: detected.headers,
          headerRowIndex: detected.headerRowIndex,
        }),
      });
      if (signRes.ok) {
        const sigBody = (await signRes.json()) as { signature: string };
        setSignature(sigBody.signature);
      } else {
        setSignature(null);
      }

      const res = await fetch("/api/template-mapping/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: detected.headers,
          headerRowIndex: detected.headerRowIndex,
        }),
      });
      if (!res.ok) {
        toast.error("模板服务暂不可用，已使用自动映射。");
        setMapping(auto.mapping);
        setStep(isCompleteMapping(auto.mapping) ? "preview" : "mapping");
        if (isCompleteMapping(auto.mapping)) {
          const built = buildDraftRowsFromMatrix(detected.dataRows, detected.headers, auto.mapping);
          setRows(built.length ? built : [emptyDraftRow()]);
          void runValidation(built.length ? built : [emptyDraftRow()]);
        }
        setImportPct(100);
        setImportLabel("完成");
        return;
      }
      const resolved = (await res.json()) as {
        signature: string;
        savedMapping: Partial<Record<OrderFieldKey, string>> | null;
      };
      setSignature(resolved.signature);

      let nextMap: Partial<Record<OrderFieldKey, string>> = { ...auto.mapping };
      if (resolved.savedMapping && isCompleteMapping(resolved.savedMapping)) {
        nextMap = { ...resolved.savedMapping };
        toast.success("已套用已保存的模板映射");
      } else {
        nextMap = { ...auto.mapping };
      }

      setMapping(nextMap);
      setImportPct(100);
      setImportLabel("完成");

      if (!isCompleteMapping(nextMap)) {
        setStep("mapping");
        toast.message("需要补充列映射", {
          description: "自动识别未覆盖全部必填字段，请手动指定列对应关系。",
        });
        return;
      }

      const built = buildDraftRowsFromMatrix(detected.dataRows, detected.headers, nextMap);
      setRows(built.length ? built : [emptyDraftRow()]);
      setStep("preview");
      void runValidation(built.length ? built : [emptyDraftRow()]);
      toast.success(`已导入 ${built.length || 1} 行预览`);
    } catch {
      toast.error("读取文件失败，请重试。");
    } finally {
      setBusy(false);
      setTimeout(() => setImportPct(0), 600);
    }
  };

  const onConfirmMapping = async (m: Partial<Record<OrderFieldKey, string>>) => {
    setBusy(true);
    try {
      if (signature) {
        const res = await fetch("/api/template-mapping/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature,
            headerRowIndex,
            fieldToColumn: m,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          toast.error(j.error ?? "保存模板失败");
          return;
        }
        toast.success("模板映射已保存，并生成预览");
      } else {
        toast.message("模板签名不可用，预览已生成（映射未写入服务器）");
      }
      setMapping(m);
      const built = buildDraftRowsFromMatrix(rawDataRows, matrixHeaders, m);
      setRows(built.length ? built : [emptyDraftRow()]);
      setStep("preview");
      void runValidation(built.length ? built : [emptyDraftRow()]);
    } finally {
      setBusy(false);
    }
  };

  const updateCell = (rowIndex: number, field: OrderFieldKey, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[rowIndex] };
      row[field] = value;
      next[rowIndex] = row;
      return next;
    });
  };

  const deleteRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((_, i) => i !== rowIndex));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyDraftRow()]);
  };

  const exportXlsx = () => {
    try {
      exportDraftRowsToXlsx(rows, `导入预览_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.xlsx`);
      toast.success("已导出 Excel");
    } catch {
      toast.error("导出失败");
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const submitAll = async () => {
    if (hasErrors) {
      toast.error("存在校验错误，请先修正所有标红的单元格。");
      return;
    }
    if (rows.length === 0) {
      toast.error("没有可提交的数据");
      return;
    }
    setSubmitting(true);
    setSubmitPct(0);
    setSubmitLabel("准备提交…");
    const batchId = crypto.randomUUID();

    const payloads = rows.map((r) => ({
      externalCode: r.externalCode.trim() || undefined,
      senderName: r.senderName,
      senderPhone: r.senderPhone,
      senderAddress: r.senderAddress,
      receiverName: r.receiverName,
      receiverPhone: r.receiverPhone,
      receiverAddress: r.receiverAddress,
      weightKg: Number(String(r.weightKg).replace(/,/g, "")),
      pieceCount: Number(String(r.pieceCount).replace(/,/g, "")),
      tempZone: r.tempZone.trim(),
      remark: r.remark.trim() || undefined,
    }));

    let success = 0;
    let failed = 0;
    const total = payloads.length;

    try {
      for (let i = 0; i < payloads.length; i += SUBMIT_CHUNK) {
        const chunk = payloads.slice(i, i + SUBMIT_CHUNK);
        setSubmitLabel(`提交中 ${Math.min(i + chunk.length, total)} / ${total}`);
        setSubmitPct(Math.round(((i + chunk.length) / total) * 100));
        const res = await fetch("/api/orders/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId, rows: chunk }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: number;
          failed?: number;
          error?: string;
        };
        if (!res.ok) {
          failed += chunk.length;
          toast.error(data.error ?? "提交失败");
          break;
        }
        success += data.success ?? 0;
        failed += data.failed ?? 0;
      }
      setSubmitPct(100);
      setSubmitLabel("完成");
      toast.success(`提交完成：成功 ${success} 条，失败 ${failed} 条`);
      if (success > 0) resetFlow();
    } catch {
      toast.error("网络错误，提交中断");
    } finally {
      setSubmitting(false);
      setTimeout(() => {
        setSubmitPct(0);
        setSubmitLabel("");
      }, 1200);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-700 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">1. 上传 Excel</h2>
        <p className="mt-1 text-sm text-slate-400">支持拖拽或点击上传，自动识别表头行与列含义。</p>
        <div className="mt-4">
          <FileDropzone
            accept=".xlsx,.xls"
            maxBytes={MAX_FILE_BYTES}
            disabled={busy || submitting}
            onFile={(f) => void processFile(f)}
            onError={(m) => toast.error(m)}
          />
        </div>
        {importPct > 0 ? (
          <div className="mt-4">
            <ProgressBar value={importPct} label={importLabel} />
          </div>
        ) : null}
      </section>

      {step === "mapping" ? (
        <section>
          <ColumnMapper
            excelHeaders={matrixHeaders}
            initialMapping={mapping}
            onConfirm={(m) => void onConfirmMapping(m)}
            onCancel={() => {
              setStep("upload");
              toast.message("已取消映射");
            }}
          />
        </section>
      ) : null}

      {step === "preview" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">2. 预览与校验</h2>
              <p className="mt-1 text-sm text-slate-400">
                点击单元格编辑，Tab / Enter 切换。以下为批量错误列表（含行号与字段）。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportXlsx}
                disabled={busy || submitting}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-100 hover:bg-slate-800 disabled:opacity-40"
              >
                导出为 Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetFlow();
                  toast.message("已重置导入流程");
                }}
                disabled={submitting}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                重新上传
              </button>
            </div>
          </div>

          {sortedErrors.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded-xl border border-red-900/40 bg-red-950/25 p-3 text-xs text-red-100">
              <div className="mb-2 font-medium text-red-200">错误明细（共 {sortedErrors.length} 条）</div>
              <ul className="space-y-1">
                {sortedErrors.map((e, idx) => (
                  <li key={`${e.row}-${e.field}-${idx}`}>{e.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
              当前批次校验通过（仍会与历史运单比对外部编码重复）。
            </div>
          )}

          <OrdersGrid
            rows={rows}
            rowFieldErrors={validation.rowFieldErrors}
            onChange={updateCell}
            onDeleteRow={deleteRow}
            onAddRow={addRow}
          />

          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
            <h3 className="text-sm font-medium text-white">3. 提交到数据库</h3>
            {submitPct > 0 ? <ProgressBar value={submitPct} label={submitLabel} /> : null}
            <button
              type="button"
              disabled={submitting || busy || hasErrors || rows.length === 0}
              onClick={() => void submitAll()}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "提交中…" : "确认提交运单"}
            </button>
            {hasErrors ? (
              <p className="text-xs text-red-300">存在未解决的校验错误时无法提交。</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
