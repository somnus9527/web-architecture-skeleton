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
    <header className="aui-page-header">
      <div>
        <h1 className="aui-page-header__title">{title}</h1>
        {description ? <p className="aui-page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="aui-page-header__actions">{actions}</div> : null}
    </header>
  );
}
