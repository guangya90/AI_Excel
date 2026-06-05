"use client";

type ProgressBarProps = {
  value: number;
  label?: string;
  subLabel?: string;
};

export function ProgressBar({ value, label, subLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="w-full space-y-1.5">
      {(label || subLabel) && (
        <div className="flex justify-between text-xs text-gray-500">
          <span className="font-medium">{label}</span>
          {subLabel ? <span>{subLabel}</span> : null}
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#0fc6c2] to-[#0bada9] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-400">{pct}%</div>
    </div>
  );
}
