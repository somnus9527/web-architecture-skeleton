import { StatusPill } from '@repo/ui/client/status-pill';
import { formatCurrency } from '@repo/tools/shared/currency';

import type { IOrder } from '@repo/types';

const ORDERS: IOrder[] = [
  { id: '1', title: '示例订单 A', status: 'pending' },
  { id: '2', title: '示例订单 B', status: 'done' },
];

const STATUS_TEXT: Record<IOrder['status'], string> = {
  pending: '待处理',
  active: '进行中',
  done: '已完成',
};

/**
 * 示例页：演示 app 如何组合 types / tools / ui。
 *
 * @returns 页面节点。
 */
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>Example App</h1>
      <p>示例金额：{formatCurrency(1288)}</p>
      <ul>
        {ORDERS.map((order) => (
          <li key={order.id} style={{ marginBottom: 8 }}>
            {order.title} <StatusPill status={order.status}>{STATUS_TEXT[order.status]}</StatusPill>
          </li>
        ))}
      </ul>
    </main>
  );
}
