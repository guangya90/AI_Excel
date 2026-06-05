"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [savedMask, setSavedMask] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 加载当前设置
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setSavedMask(data.settings.deepseek_api_key || "");
          setModel(data.settings.ai_model || "deepseek-chat");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    if (!apiKey.trim() && !savedMask) {
      toast.error("请输入 API Key");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = { ai_model: model };
      if (apiKey.trim()) body.deepseek_api_key = apiKey.trim();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("保存失败");
      toast.success("设置已保存");
      setApiKey("");
      onClose();
    } catch {
      toast.error("保存设置失败");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* 弹窗 */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">系统设置</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-[#0fc6c2] border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                DeepSeek API Key
                {savedMask && !apiKey && (
                  <span className="ml-2 text-xs text-green-500 font-normal">已配置 ({savedMask})</span>
                )}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={savedMask ? "留空则不修改已有Key" : "sk-xxxxxxxxxxxxxxxx"}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0fc6c2] focus:ring-1 focus:ring-[#0fc6c2]/30 transition"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                用于 AI 智能分析文件结构，自动生成解析规则。留空则仅使用系统自动匹配。
              </p>
            </div>

            {/* 模型选择 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">AI 模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#0fc6c2]"
              >
                <option value="deepseek-chat">DeepSeek V3 (推荐)</option>
                <option value="deepseek-reasoner">DeepSeek R1 (深度推理)</option>
              </select>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-sm rounded-xl text-gray-600 hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-[#0fc6c2] text-white text-sm font-medium rounded-xl hover:bg-[#0bada9] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    保存中...
                  </>
                ) : (
                  "保存设置"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
