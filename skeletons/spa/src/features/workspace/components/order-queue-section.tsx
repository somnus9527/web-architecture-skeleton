import { Search } from 'lucide-react';

import type { IOrderQueueItem, IOrderQueueQuery, IStatusOption } from '@/features/workspace/types/workspace.types';
import { ORDER_STATUS_TONE } from '@/features/workspace/utils/workspace.config';
import { t } from '@/locale';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { StatusPill } from '@/shared/components/ui/status-pill';

/**
 * 订单队列组件参数。
 */
interface IOrderQueueSectionProps {
  /**
   * 当前订单列表。
   */
  orders: IOrderQueueItem[];
  /**
   * 状态筛选选项。
   */
  statusOptions: IStatusOption[];
  /**
   * 当前查询条件。
   */
  query: IOrderQueueQuery;
  /**
   * 是否仍在加载列表。
   */
  loading: boolean;
  /**
   * 动作完成后的提示。
   */
  notice: string | null;
  /**
   * 正在执行动作的订单 id。
   */
  actioningOrderId: string | null;
  /**
   * 关键词变化回调。
   */
  onKeywordChange: (keyword: string) => void;
  /**
   * 状态筛选变化回调。
   */
  onStatusChange: (status: IOrderQueueQuery['status']) => void;
  /**
   * 推进订单回调。
   */
  onAdvanceOrder: (order: IOrderQueueItem) => Promise<void>;
}

/**
 * 渲染可筛选、可操作的订单队列。
 *
 * @param props - 订单队列组件参数。
 * @returns 订单队列节点。
 */
export function OrderQueueSection({
  orders,
  statusOptions,
  query,
  loading,
  notice,
  actioningOrderId,
  onKeywordChange,
  onStatusChange,
  onAdvanceOrder,
}: IOrderQueueSectionProps) {
  const isEmpty = !loading && orders.length === 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="dashboard-order-queue">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">{t('dashboard.queue.title')}</h2>
          <p className="mt-1 text-xs text-slate-500">{t('dashboard.queue.description')}</p>
        </div>
        {/* 筛选控件作为列表状态入口，变更后由 hook 重新查询数据。 */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-900 sm:w-64"
              value={query.keyword}
              placeholder={t('dashboard.search.placeholder')}
              onChange={(event) => onKeywordChange(event.target.value)}
            />
          </label>
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900"
            value={query.status}
            onChange={(event) => {
              const selectedStatus = statusOptions.find((option) => option.value === event.target.value)?.value;

              if (selectedStatus) {
                onStatusChange(selectedStatus);
              }
            }}
          >
            {statusOptions.map((option) => (
              /* 状态筛选来自统一配置，避免 select 文案和状态标签文案漂移。 */
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice ? (
        /* 动作反馈放在列表上方，避免用户推进订单后无法确认结果。 */
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
        {loading ? (
          /* 列表 loading 态用稳定骨架行占位。 */
          <div className="space-y-2 p-3" data-testid="dashboard-order-loading">
            {[0, 1, 2].map((index) => (
              <div className="h-16 rounded-md bg-slate-100" key={index} />
            ))}
          </div>
        ) : null}

        {isEmpty ? (
          /* 空态走共享组件，文案仍由本层提供。 */
          <div data-testid="dashboard-order-empty">
            <EmptyState title={t('dashboard.queue.empty')} />
          </div>
        ) : null}

        {!loading && !isEmpty ? (
          /* 订单行列表在骨架阶段数量有限，真实长列表接入后应替换为虚拟滚动。 */
          <div className="divide-y divide-slate-200">
            {orders.map((order) => {
              const isActioning = actioningOrderId === order.id;

              return (
                <article
                  className="grid gap-3 bg-white p-4 md:grid-cols-[7rem_minmax(0,1fr)_10rem_8rem] md:items-center"
                  key={order.id}
                >
                  <div>
                    <p className="text-xs text-slate-500">{order.updatedAt}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{order.id}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-950">{order.customerName}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{order.productName}</p>
                  </div>
                  <div>
                    <StatusPill tone={ORDER_STATUS_TONE[order.status]}>
                      {t(`dashboard.status.${order.status}`)}
                    </StatusPill>
                    <p className="mt-2 text-xs text-slate-500">{order.nextStep}</p>
                  </div>
                  {/* 推进按钮暴露 pending 态，避免重复点击。 */}
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    type="button"
                    disabled={isActioning || order.status === 'completed'}
                    onClick={() => {
                      void onAdvanceOrder(order);
                    }}
                  >
                    {isActioning ? t('dashboard.action.processing') : t('dashboard.action.advance')}
                  </button>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
