import { t } from '@/locale';

import type { IStatusOption, OrderStatus } from '@/features/workspace/types/workspace.types';
import type { StatusTone } from '@/shared/components/ui/status-pill';

/**
 * 订单状态筛选选项，供页面筛选控件复用。
 */
export const ORDER_STATUS_OPTIONS: IStatusOption[] = [
  { value: 'all', label: t('dashboard.status.all') },
  { value: 'pending', label: t('dashboard.status.pending') },
  { value: 'reviewing', label: t('dashboard.status.reviewing') },
  { value: 'fulfilling', label: t('dashboard.status.fulfilling') },
  { value: 'completed', label: t('dashboard.status.completed') },
];

/**
 * 订单状态到语义色调的映射，放在 feature 内，避免共享组件认识业务枚举。
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, StatusTone> = {
  pending: 'warning',
  reviewing: 'info',
  fulfilling: 'info',
  completed: 'success',
};
