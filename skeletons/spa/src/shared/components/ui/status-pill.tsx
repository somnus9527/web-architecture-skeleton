import type { ReactNode } from 'react';

/**
 * 状态胶囊的语义色调。
 */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * 状态胶囊参数。
 */
export interface IStatusPillProps {
  /**
   * 语义色调，由调用方按业务状态映射。
   */
  tone: StatusTone;
  /**
   * 展示文案，由调用方负责 i18n。
   */
  children: ReactNode;
}

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
};

/**
 * 以稳定视觉语义展示短文本状态。
 *
 * 组件不认识业务枚举，也不调用 i18n：业务状态到 tone 的映射留在 feature，
 * 文案由调用方传入。这样同一组件可被任意业务域复用。
 *
 * @param props - 状态胶囊参数。
 * @returns 状态标签节点。
 */
export function StatusPill({ tone, children }: IStatusPillProps) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}
