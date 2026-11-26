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
    <section className="panel" data-testid="dashboard-workflow">
      <h2 className="panel__title">{t('dashboard.workflow.title')}</h2>
      <div className="workflow-list">
        {loading
          ? [0, 1, 2, 3].map((index) => <div className="skeleton skeleton--workflow" key={index} />)
          : stages.map((stage) => (
              /* 阶段行展示数量和建议动作，便于运营快速定位瓶颈。 */
              <article className="workflow-row" key={stage.name}>
                <div className="workflow-row__header">
                  <p className="workflow-row__name">{stage.name}</p>
                  <p className="workflow-row__count">{stage.count}</p>
                </div>
                <p className="workflow-row__action">{stage.action}</p>
              </article>
            ))}
      </div>
    </section>
  );
}
