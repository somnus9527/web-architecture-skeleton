import type { IWorkflowStage } from '@/features/workspace/types/workspace.types';
import { t } from '@/locale';

/**
 * 流程区组件参数。
 */
interface IWorkflowSectionProps {
  /**
   * 履约阶段列表。
   */
  stages: IWorkflowStage[];
  /**
   * 是否仍在加载首屏数据。
   */
  loading: boolean;
}

/**
 * 渲染履约流程概览。
 *
 * @param props - 流程区组件参数。
 * @returns 流程区节点。
 */
export function WorkflowSection({ stages, loading }: IWorkflowSectionProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="dashboard-workflow">
      <h2 className="text-sm font-semibold text-slate-950">{t('dashboard.workflow.title')}</h2>
      <div className="mt-4 space-y-3">
        {loading
          ? [0, 1, 2, 3].map((index) => (
              /* loading 期间保持流程列表高度稳定。 */
              <div className="h-16 rounded-md border border-slate-200 bg-slate-100" key={index} />
            ))
          : stages.map((stage) => (
              /* 阶段行展示数量和建议动作，便于运营快速定位瓶颈。 */
              <article className="rounded-md border border-slate-200 bg-slate-50 p-3" key={stage.name}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{stage.name}</p>
                  <p className="text-lg font-semibold text-slate-950">{stage.count}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{stage.action}</p>
              </article>
            ))}
      </div>
    </section>
  );
}
