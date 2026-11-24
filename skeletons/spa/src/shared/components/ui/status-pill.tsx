import type { OrderStatus } from '@/features/workspace/types/workspace.types';
import { t } from '@/locale';

/**
 * 状态标签组件参数。
 */
interface IStatusPillProps {
  /**
   * 订单履约状态。
   */
  status: OrderStatus;
}

const STATUS_CLASS_BY_STATUS: Record<OrderStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  reviewing: 'border-rose-200 bg-rose-50 text-rose-800',
  fulfilling: 'border-blue-200 bg-blue-50 text-blue-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

/**
 * 以稳定视觉语义展示订单状态。
 *
 * @param props - 状态标签组件参数。
 * @returns 状态标签节点。
 */
export function StatusPill({ status }: IStatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASS_BY_STATUS[status]}`}
    >
      {t(`dashboard.status.${status}`)}
    </span>
  );
}
