import { RefreshCcw } from 'lucide-react';

import { MetricSection } from '@/features/workspace/components/metric-section';
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
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* 页面头部展示当前应用上下文和刷新入口。 */}
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end">
          <div>
            <p className="inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
              {t('app.badge')}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950">{t('app.title')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('app.subtitle')}</p>
          </div>
          {/* 刷新按钮只重拉当前工作台数据，不改变筛选条件。 */}
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isLoading}
            onClick={workspace.reload}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            {isLoading ? t('common.loading') : t('common.retry')}
          </button>
        </header>

        {isError ? (
          /* 错误态提供重试入口，避免请求失败时只留下空白区域。 */
          <section className="rounded-lg border border-red-200 bg-red-50 p-5" data-testid="dashboard-error">
            <p className="text-sm font-semibold text-red-800">{t('common.error.title')}</p>
            <p className="mt-2 text-sm text-red-700">{workspace.errorMessage}</p>
          </section>
        ) : (
          <>
            {/* 指标和流程用于快速扫描工作台健康度。 */}
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
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
