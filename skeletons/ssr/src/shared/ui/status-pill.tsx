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

/**
 * 以稳定视觉语义展示短文本状态。
 *
 * @param props - 状态胶囊参数。
 * @returns 状态标签节点。
 */
export function StatusPill({ tone, children }: IStatusPillProps) {
  return <span className={`aui-status-pill aui-status-pill--${tone}`}>{children}</span>;
}
