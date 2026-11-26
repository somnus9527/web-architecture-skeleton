import { MetricSection } from '@/features/workspace/components/metric-section';
import { AsyncState, Button, RefreshCcw } from '@/shared/ui';
import { OrderQueueSection } from '@/features/workspace/components/order-queue-section';
import { WorkflowSection } from '@/features/workspace/components/workflow-section';
import { useWorkspaceDashboard } from '@/features/workspace/hooks/use-workspace-dashboard';
import { ORDER_STATUS_OPTIONS } from '@/features/workspace/utils/workspace.config';
import { t } from '@/locale';

/**
 * 工作台首屏页面，负责装配指标、流程和订单队列。
 *
 * @returns 工作台页面节点。
 */
export function Component() {
  const workspace = useWorkspaceDashboard();
  const isLoading = workspace.loadState === 'loading';
  const isError = workspace.loadState === 'error';

  return (
    <main className="dashboard">
      <div className="dashboard__container">
        {/* 页面头部展示当前应用上下文和刷新入口。 */}
        <header className="dashboard__header">
          <div>
            <p className="dashboard__badge">{t('app.badge')}</p>
            <h1 className="dashboard__title">{t('app.title')}</h1>
            <p className="dashboard__subtitle">{t('app.subtitle')}</p>
          </div>
          {/* 刷新按钮只重拉当前工作台数据，不改变筛选条件。 */}
          <Button tone="ghost" icon={<RefreshCcw aria-hidden="true" />} disabled={isLoading} onClick={workspace.reload}>
            {isLoading ? t('common.loading') : t('common.retry')}
          </Button>
        </header>

        {isError ? (
          /* 错误态走共享三态出口，文案与重试入口仍由页面提供。 */
          <AsyncState
            loading={false}
            error
            errorNode={
              <section className="dashboard__error" data-testid="dashboard-error">
                <h2>{t('common.error.title')}</h2>
                <p>{workspace.errorMessage}</p>
              </section>
            }
          >
            {null}
          </AsyncState>
        ) : (
          <>
            {/* 指标和流程用于快速扫描工作台健康度。 */}
            <section className="dashboard__grid">
              <MetricSection metrics={workspace.dashboard?.metrics ?? []} loading={isLoading} />
              <WorkflowSection stages={workspace.dashboard?.workflow ?? []} loading={isLoading} />
            </section>

            {/* 订单队列承载筛选、空态和状态推进交互。 */}
            <OrderQueueSection
              orders={workspace.dashboard?.orders ?? []}
              statusOptions={ORDER_STATUS_OPTIONS}
              query={workspace.query}
              loading={isLoading}
              notice={workspace.notice}
              actioningOrderId={workspace.actioningOrderId}
              onKeywordChange={workspace.updateKeyword}
              onStatusChange={workspace.updateStatus}
              onAdvanceOrder={workspace.advanceOrder}
            />
          </>
        )}
      </div>
    </main>
  );
}
