import type { IOrderQueueItem, IOrderQueueQuery, IStatusOption } from '@/features/workspace/types/workspace.types';
import { ORDER_STATUS_TONE } from '@/features/workspace/utils/workspace.config';
import { t } from '@/locale';
import { Button, EmptyState, Input, Search, Select, StatusPill } from '@/shared/ui';

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
    <section className="panel" data-testid="dashboard-order-queue">
      <div className="panel__header">
        <div>
          <h2 className="panel__title">{t('dashboard.queue.title')}</h2>
          <p className="panel__hint">{t('dashboard.queue.description')}</p>
        </div>
        {/* 筛选控件作为列表状态入口，变更后由 hook 重新查询数据。 */}
        <div className="order-toolbar">
          <Input
            prefix={<Search aria-hidden="true" />}
            value={query.keyword}
            placeholder={t('dashboard.search.placeholder')}
            onChange={(event) => onKeywordChange(event.target.value)}
          />
          <Select
            value={query.status}
            options={statusOptions.map((option) => ({ value: option.value, label: option.label }))}
            onChange={(value) => onStatusChange(value as IOrderQueueQuery['status'])}
          />
        </div>
      </div>

      {notice ? (
        /* 动作反馈放在列表上方，避免用户推进订单后无法确认结果。 */
        <p className="auth-hint" role="status">
          {notice}
        </p>
      ) : null}

      <div className="order-list">
        {loading ? (
          /* 列表 loading 态用稳定骨架行占位。 */
          <div data-testid="dashboard-order-loading">
            {[0, 1, 2].map((index) => (
              <div className="skeleton skeleton--order" key={index} />
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
          <div>
            {orders.map((order) => {
              const isActioning = actioningOrderId === order.id;

              return (
                <article className="order-row" key={order.id}>
                  <div>
                    <p className="order-row__time">{order.updatedAt}</p>
                    <p className="order-row__id">{order.id}</p>
                  </div>
                  <div>
                    <p className="order-row__customer">{order.customerName}</p>
                    <p className="order-row__product">{order.productName}</p>
                  </div>
                  <div>
                    <StatusPill tone={ORDER_STATUS_TONE[order.status]}>
                      {t(`dashboard.status.${order.status}`)}
                    </StatusPill>
                    <p className="order-row__next">{order.nextStep}</p>
                  </div>
                  {/* 推进按钮暴露 pending 态，避免重复点击。 */}
                  <div className="order-row__action">
                    <Button
                      isPending={isActioning}
                      pendingLabel={t('dashboard.action.processing')}
                      disabled={order.status === 'completed'}
                      onClick={() => {
                        void onAdvanceOrder(order);
                      }}
                    >
                      {t('dashboard.action.advance')}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
