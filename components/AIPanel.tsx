"use client";

import { useState } from "react";
import type { GenerateRuleResponse } from "@/lib/ai-rule-generator";

interface AIPanelProps {
  fileInfo: {
    fileName: string; fileFormat: string; sheetNames: string[];
    headerPreview: string; sampleRows: string; totalRows: number; totalCols: number; textContent?: string;
    extractedKVs?: Record<string, string>;
  } | null;
  detectedColumns?: string[];
  onRuleGenerated: (result: GenerateRuleResponse) => void;
}

export default function AIPanel({ fileInfo, detectedColumns, onRuleGenerated }: AIPanelProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<GenerateRuleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const startAnalysis = async () => {
    if (!fileInfo) return;
    setAnalyzing(true); setError(null); setProgress(0);
    const timer = setInterval(() => setProgress((p) => Math.min(p + 3, 85)), 300);

    try {
      const res = await fetch("/api/ai/generate-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fileInfo,
          detectedColumns,
          extractedKVs: fileInfo.extractedKVs,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 生成失败");
      setProgress(100); setResult(data);
      onRuleGenerated(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 分析失败");
    } finally {
      clearInterval(timer); setAnalyzing(false);
    }
  };

  if (!fileInfo) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">AI 智能分析</h3>
          <p className="text-xs text-gray-400 mt-0.5">由 DeepSeek 大模型自动分析文件结构并生成解析规则</p>
        </div>
        {!analyzing && !result && (
          <button onClick={startAnalysis}
            className="px-5 py-2.5 bg-gradient-to-r from-[#0fc6c2] to-[#0bada9] text-white text-sm font-medium rounded-xl hover:shadow-lg transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            开始 AI 分析
          </button>
        )}
      </div>

      {/* 文件信息 */}
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
        <span>文件名：{fileInfo.fileName}</span>
        <span>格式：{fileInfo.fileFormat}</span>
        <span>总行数：{fileInfo.totalRows}</span>
        <span>总列数：{fileInfo.totalCols}</span>
        {detectedColumns && detectedColumns.length > 0 && (
          <span className="col-span-2 truncate">检测列：{detectedColumns.slice(0, 12).join(" | ")}{detectedColumns.length > 12 ? " …" : ""}</span>
        )}
      </div>

      {/* 进度 */}
      {analyzing && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-[#0fc6c2] border-t-transparent rounded-full" />
            <span className="text-sm text-gray-600">DeepSeek 正在分析文件结构...</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-full bg-gradient-to-r from-[#0fc6c2] to-[#0bada9] rounded-full transition-all duration-700"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400">
            {progress < 30 ? "读取文件..." : progress < 60 ? "匹配字段..." : "生成规则..."}
          </p>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-600">分析失败</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
          <button onClick={startAnalysis} className="mt-2 text-xs text-[#0fc6c2] hover:underline">重试</button>
        </div>
      )}

      {/* 结果 */}
      {result && !analyzing && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            AI 规则生成完成
          </div>
          <p className="text-xs text-gray-500">{result.reasoning}</p>

          {/* 置信度 */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(result.confidence).map(([field, level]) => (
              <span key={field} className={`text-[10px] px-2 py-0.5 rounded-full ${
                level === "high" ? "bg-green-50 text-green-600" : level === "medium" ? "bg-yellow-50 text-yellow-600" : "bg-red-50 text-red-500"
              }`}>
                {field}: {level === "high" ? "✓" : level === "medium" ? "⚠" : "✗"}
              </span>
            ))}
          </div>

          {result.tokenUsage && (
            <p className="text-xs text-gray-300">Token: {result.tokenUsage.promptTokens} in + {result.tokenUsage.completionTokens} out</p>
          )}

          <p className="text-xs text-[#0fc6c2] font-medium">AI 生成结果已填入下方编辑区，请确认后保存</p>
        </div>
      )}
    </div>
  );
}
