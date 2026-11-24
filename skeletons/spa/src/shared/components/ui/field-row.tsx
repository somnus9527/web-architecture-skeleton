import type { ReactNode } from 'react';

/**
 * 只读字段行参数。
 */
export interface IFieldRowProps {
  /**
   * 字段名。
   */
  label: ReactNode;
  /**
   * 字段值。
   */
  value: ReactNode;
  /**
   * 字段说明。
   */
  hint?: ReactNode;
}

/**
 * 详情页与表单里的只读字段行：左侧名称、右侧值。
 *
 * @param props - 字段行参数。
 * @returns 字段行节点。
 */
export function FieldRow({ label, value, hint }: IFieldRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm text-slate-900">
        {value}
        {hint ? <span className="mt-0.5 block text-xs text-slate-400">{hint}</span> : null}
      </span>
    </div>
  );
}
