import type { ReactNode } from 'react';

/**
 * 指标卡语义色调。
 */
export type StatTone = 'neutral' | 'success' | 'warning' | 'danger';

/**
 * 指标卡参数。
 */
export interface IStatCardProps {
  /**
   * 指标名称。
   */
  label: ReactNode;
  /**
   * 指标值；数字由调用方格式化。
   */
  value: ReactNode;
  /**
   * 变化量或补充说明。
   */
  delta?: ReactNode;
  /**
   * 语义色调。
   */
  tone?: StatTone;
}

const TONE_TEXT: Record<StatTone, string> = {
  neutral: 'text-slate-900',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
};

/**
 * 指标卡：名称、数值、可选变化量。
 *
 * @param props - 指标卡参数。
 * @returns 指标卡节点。
 */
export function StatCard({ label, value, delta, tone = 'neutral' }: IStatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
      {delta ? <p className="mt-1 text-xs text-slate-500">{delta}</p> : null}
    </div>
  );
}
