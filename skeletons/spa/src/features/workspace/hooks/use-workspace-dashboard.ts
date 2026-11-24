import { useEffect, useMemo, useState } from 'react';

import { advanceOrderStatus, getWorkspaceDashboard } from '@/features/workspace/services/workspace-service';
import { t } from '@/locale';
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
 * @returns 工作台页面需要的状态与事件。
 */
export function useWorkspaceDashboard(): IUseWorkspaceDashboardResult {
  const [dashboard, setDashboard] = useState<IWorkspaceDashboard | null>(null);
  const [query, setQuery] = useState<IOrderQueueQuery>(INITIAL_QUERY);
  const [loadState, setLoadState] = useState<DashboardLoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actioningOrderId, setActioningOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    /**
     * 加载工作台数据，并把 API 错误映射成页面错误态。
     */
    async function loadDashboard(): Promise<void> {
      setLoadState('loading');
      setErrorMessage(null);

      try {
        const nextDashboard = await getWorkspaceDashboard(query);

        if (isActive) {
          setDashboard(nextDashboard);
          setLoadState('success');
        }
      } catch (error) {
        logger.error('workspace_dashboard_load_failed', { error });

        if (isActive) {
          setErrorMessage(t('common.error.description'));
          setLoadState('error');
        }
      }
    }

    void loadDashboard();

    return () => {
      isActive = false;
    };
  }, [query, refreshKey]);

  const result = useMemo<IUseWorkspaceDashboardResult>(
    () => ({
      loadState,
      errorMessage,
      dashboard,
      query,
      actioningOrderId,
      notice,
      updateKeyword: (keyword: string) => {
        setNotice(null);
        setQuery((current) => ({ ...current, keyword }));
      },
      updateStatus: (status: IOrderQueueQuery['status']) => {
        setNotice(null);
        setQuery((current) => ({ ...current, status }));
      },
      reload: () => {
        setRefreshKey((current) => current + 1);
      },
      advanceOrder: async (order: IOrderQueueItem) => {
        setActioningOrderId(order.id);
        setNotice(null);

        try {
          const nextStatus = await advanceOrderStatus(order.id, order.status);

          setDashboard((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              orders: current.orders.map((currentOrder) =>
                currentOrder.id === order.id ? { ...currentOrder, status: nextStatus } : currentOrder,
              ),
            };
          });
          setNotice(t('dashboard.notice.advanced'));
        } catch (error) {
          logger.error('workspace_order_advance_failed', { error, orderId: order.id });
          setErrorMessage(t('common.error.description'));
        } finally {
          setActioningOrderId(null);
        }
      },
    }),
    [actioningOrderId, dashboard, errorMessage, loadState, notice, query],
  );

  return result;
}
