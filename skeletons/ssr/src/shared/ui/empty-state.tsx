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
    <div className="aui-empty-state">
      {icon ? <div className="aui-empty-state__icon">{icon}</div> : null}
      <p className="aui-empty-state__title">{title}</p>
      {description ? <p className="aui-empty-state__description">{description}</p> : null}
      {action ? <div className="aui-empty-state__action">{action}</div> : null}
    </div>
  );
}
