import { t } from '@/locale';

import type { IStatusOption } from '@/features/workspace/types/workspace.types';

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
