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

const TONE_CLASS: Record<StatTone, string> = {
  neutral: 'aui-stat-card__value--neutral',
  success: 'aui-stat-card__value--success',
  warning: 'aui-stat-card__value--warning',
  danger: 'aui-stat-card__value--danger',
};

/**
 * 指标卡：名称、数值、可选变化量。
 *
 * @param props - 指标卡参数。
 * @returns 指标卡节点。
 */
export function StatCard({ label, value, delta, tone = 'neutral' }: IStatCardProps) {
  return (
    <div className="aui-stat-card">
      <p className="aui-stat-card__label">{label}</p>
      <p className={`aui-stat-card__value ${TONE_CLASS[tone]}`}>{value}</p>
      {delta ? <p className="aui-stat-card__delta">{delta}</p> : null}
    </div>
  );
}
