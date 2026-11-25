import type { OrderStatus } from '@repo/types';
import type { ReactNode } from 'react';

const TONE: Record<OrderStatus, string> = {
  pending: '#b45309',
  active: '#1d4ed8',
  done: '#047857',
};

/**
 * 订单状态标签。展示文案由 app 通过 children 注入，组件不硬编码业务文案。
 *
 * @param props - 状态与文案。
 * @returns 标签节点。
 */
export function StatusPill({ status, children }: { status: OrderStatus; children: ReactNode }) {
  return (
    <span style={{ color: TONE[status], border: `1px solid ${TONE[status]}`, borderRadius: 999, padding: '2px 8px' }}>
      {children}
    </span>
  );
}
