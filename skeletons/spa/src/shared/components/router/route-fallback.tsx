import { Link } from 'react-router';

import { t } from '@/locale';
import { ROUTE_PATHS } from '@/router/route-paths';

/**
 * 路由占位页组件参数。
 */
export interface IRouteFallbackProps {
  /**
   * 标题 i18n key。
   */
  titleKey: string;
  /**
   * 描述 i18n key。
   */
  descriptionKey: string;
}

/**
 * 渲染尚未实现或未匹配路由的占位页面。
 *
 * @param props - 路由占位页组件参数。
 * @returns 路由占位页节点。
 */
export function RouteFallback({ titleKey, descriptionKey }: IRouteFallbackProps) {
  return (
    <main className="page-center">
      {/* 路由占位内容用于保留导航结构，不承载真实业务逻辑。 */}
      <section className="error-card">
        <p className="error-card__title">{t(titleKey)}</p>
        <p className="error-card__description">{t(descriptionKey)}</p>
        {/* 返回工作台入口，避免占位页面成为导航死路。 */}
        <div className="error-card__action">
          <Link className="button-link" to={ROUTE_PATHS.workspace}>
            {t('routes.back_to_workspace')}
          </Link>
        </div>
      </section>
    </main>
  );
}
