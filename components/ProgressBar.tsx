"use client";

type ProgressBarProps = {
  value: number;
  label?: string;
  subLabel?: string;
};

export function ProgressBar({ value, label, subLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="w-full space-y-1">
      {(label || subLabel) && (
        <div className="flex justify-between text-xs text-slate-400">
          <span>{label}</span>
          {subLabel ? <span>{subLabel}</span> : null}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-slate-500">{pct}%</div>
    </div>
  );
}
