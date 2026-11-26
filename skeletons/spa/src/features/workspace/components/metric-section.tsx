import type { IMetricItem, MetricTone } from '@/features/workspace/types/workspace.types';
import { t } from '@/locale';
import { Activity, CircleDollarSign, PackageCheck, ShieldAlert } from '@/shared/ui';

/**
 * 指标区组件参数。
 */
interface IMetricSectionProps {
  /**
   * 指标列表。
   */
  metrics: IMetricItem[];
  /**
   * 是否仍在加载首屏数据。
   */
  loading: boolean;
}

const TONE_CLASS_BY_TONE: Record<MetricTone, string> = {
  neutral: 'metric-card__icon--neutral',
  success: 'metric-card__icon--success',
  warning: 'metric-card__icon--warning',
  danger: 'metric-card__icon--danger',
};

const ICONS = [CircleDollarSign, Activity, PackageCheck, ShieldAlert];

/**
 * 渲染工作台关键指标。
 *
 * @param props - 指标区组件参数。
 * @returns 指标区节点。
 */
export function MetricSection({ metrics, loading }: IMetricSectionProps) {
  return (
    <section className="panel" data-testid="dashboard-metrics">
      <div className="metric-card__header">
        <h2 className="panel__title">{t('dashboard.metrics.title')}</h2>
        <p className="panel__meta">{t('app.updated')}</p>
      </div>
      <div className="metric-grid">
        {loading
          ? [0, 1, 2, 3].map((index) => <div className="skeleton skeleton--metrics" key={index} />)
          : metrics.map((metric, index) => {
              const Icon = ICONS[index % ICONS.length];

              return (
                /* 每个指标卡片固定结构，便于后续替换真实指标。 */
                <article className="metric-card" key={metric.label}>
                  <div className="metric-card__header">
                    <p className="metric-card__label">{metric.label}</p>
                    <span className={`metric-card__icon ${TONE_CLASS_BY_TONE[metric.tone]}`}>
                      <Icon aria-hidden="true" />
                    </span>
                  </div>
                  <p className="metric-card__value">{metric.value}</p>
                  <p className="metric-card__delta">{metric.delta}</p>
                </article>
              );
            })}
      </div>
    </section>
  );
}
