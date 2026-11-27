import { useCallback, useState } from 'react';

import { LOG_EVENTS } from '@/shared/observability/events';
import { advanceOrderStatus, getWorkspaceDashboard } from '@/features/workspace/services/workspace-service';
import { t } from '@/locale';
import { useAsyncAction, useRequest } from '@/shared/hooks';
import { logger } from '@/shared/services/logger';

import type {
  IOrderQueueItem,
  IOrderQueueQuery,
  IWorkspaceDashboard,
} from '@/features/workspace/types/workspace.types';

/**
 * 工作台数据加载状态。
 */
type DashboardLoadState = 'loading' | 'success' | 'error';

/**
 * 工作台 hook 返回值。
 */
export interface IUseWorkspaceDashboardResult {
  /**
   * 当前加载状态。
   */
  loadState: DashboardLoadState;
  /**
   * 用户可见错误说明。
   */
  errorMessage: string | null;
  /**
   * 工作台首屏数据。
   */
  dashboard: IWorkspaceDashboard | null;
  /**
   * 订单队列查询条件。
   */
  query: IOrderQueueQuery;
  /**
   * 异步动作中的订单 id。
   */
  actioningOrderId: string | null;
  /**
   * 动作完成后的轻量提示。
   */
  notice: string | null;
  /**
   * 更新订单关键词。
   */
  updateKeyword: (keyword: string) => void;
  /**
   * 更新订单状态筛选。
   */
  updateStatus: (status: IOrderQueueQuery['status']) => void;
  /**
   * 重新拉取工作台数据。
   */
  reload: () => void;
  /**
   * 推进订单状态。
   */
  advanceOrder: (order: IOrderQueueItem) => Promise<void>;
}

const INITIAL_QUERY: IOrderQueueQuery = {
  keyword: '',
  status: 'all',
};

/**
 * 维护工作台数据、筛选条件和订单推进动作。
 *
 * 数据读取与写操作都组合共享原语：读取交给 useRequest，推进交给 useAsyncAction。
 * 文案与日志事件名留在本层，原语不感知业务。
 *
 * @returns 工作台页面需要的状态与事件。
 */
export function useWorkspaceDashboard(): IUseWorkspaceDashboardResult {
  const [query, setQuery] = useState<IOrderQueueQuery>(INITIAL_QUERY);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchDashboard = useCallback(() => getWorkspaceDashboard(query), [query]);
  const request = useRequest(fetchDashboard, {
    deps: [query],
    formatError: () => t('common.error.description'),
    onError: (error) => logger.error(LOG_EVENTS.WORKSPACE_DASHBOARD_LOAD_FAILED, { error }),
  });

  const advance = useAsyncAction((order: IOrderQueueItem) => advanceOrderStatus(order.id, order.status), {
    keyOf: (order) => order.id,
    formatError: () => t('common.error.description'),
    onError: (error) => logger.error(LOG_EVENTS.WORKSPACE_ORDER_ADVANCE_FAILED, { error }),
    onSuccess: (nextStatus, order) => {
      request.mutate((current) =>
        current
          ? {
              ...current,
              orders: current.orders.map((currentOrder) =>
                currentOrder.id === order.id ? { ...currentOrder, status: nextStatus } : currentOrder,
              ),
            }
          : current,
      );
      setNotice(t('dashboard.notice.advanced'));
    },
  });

  const loadState: DashboardLoadState = request.loading ? 'loading' : request.error !== null ? 'error' : 'success';

  return {
    loadState,
    errorMessage: request.errorMessage,
    dashboard: request.data,
    query,
    actioningOrderId: advance.pending ? advance.pendingKey : null,
    notice,
    updateKeyword: (keyword) => {
      setNotice(null);
      setQuery((current) => ({ ...current, keyword }));
    },
    updateStatus: (status) => {
      setNotice(null);
      setQuery((current) => ({ ...current, status }));
    },
    reload: () => {
      void request.refetch();
    },
    advanceOrder: async (order) => {
      setNotice(null);
      await advance.run(order);
    },
  };
}
