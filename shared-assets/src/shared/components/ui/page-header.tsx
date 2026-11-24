import type { ReactNode } from 'react';

/**
 * 页面标题区参数。
 */
export interface IPageHeaderProps {
  /**
   * 页面主标题。
   */
  title: ReactNode;
  /**
   * 标题下的说明。
   */
  description?: ReactNode;
  /**
   * 右侧操作区。
   */
  actions?: ReactNode;
}

/**
 * 页面标题区：左侧标题与说明，右侧操作。
 *
 * @param props - 标题区参数。
 * @returns 标题区节点。
 */
export function PageHeader({ title, description, actions }: IPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
