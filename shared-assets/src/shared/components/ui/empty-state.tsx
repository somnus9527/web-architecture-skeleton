import type { ReactNode } from 'react';

/**
 * 空态参数。
 */
export interface IEmptyStateProps {
  /**
   * 装饰图标；无文案语义时应由调用方标记 aria-hidden。
   */
  icon?: ReactNode;
  /**
   * 标题。
   */
  title: ReactNode;
  /**
   * 补充说明。
   */
  description?: ReactNode;
  /**
   * 引导动作，例如"新建"按钮。
   */
  action?: ReactNode;
}

/**
 * 统一的空数据态：图标在上、文案在下、纵向居中。
 *
 * @param props - 空态参数。
 * @returns 空态节点。
 */
export function EmptyState({ icon, title, description, action }: IEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icon ? <div className="text-slate-400">{icon}</div> : null}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
