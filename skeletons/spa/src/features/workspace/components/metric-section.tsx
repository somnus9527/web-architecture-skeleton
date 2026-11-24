import { Activity, CircleDollarSign, PackageCheck, ShieldAlert } from 'lucide-react';

import type { IMetricItem, MetricTone } from '@/features/workspace/types/workspace.types';
import { t } from '@/locale';

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
  neutral: 'border-slate-200 bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-800',
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
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-testid="dashboard-metrics">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-950">{t('dashboard.metrics.title')}</h2>
        <p className="text-xs text-slate-500">{t('app.updated')}</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2">
        {loading
          ? [0, 1, 2, 3].map((index) => (
              /* loading 期间用固定高度骨架块，避免指标卡片加载前后跳动。 */
              <div className="h-28 rounded-md border border-slate-200 bg-slate-100" key={index} />
            ))
          : metrics.map((metric, index) => {
              const Icon = ICONS[index % ICONS.length];

              return (
                /* 每个指标卡片固定结构，便于后续替换真实指标。 */
                <article className="rounded-md border border-slate-200 bg-slate-50 p-4" key={metric.label}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase text-slate-500">{metric.label}</p>
                    <span className={`rounded-md border p-1.5 ${TONE_CLASS_BY_TONE[metric.tone]}`}>
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-slate-950">{metric.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{metric.delta}</p>
                </article>
              );
            })}
      </div>
    </section>
  );
}
