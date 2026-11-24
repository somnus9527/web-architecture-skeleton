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
    <main className="grid min-h-screen place-items-center bg-[#f6f7f9] px-4 text-slate-900">
      {/* 路由占位内容用于保留导航结构，不承载真实业务逻辑。 */}
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-950">{t(titleKey)}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{t(descriptionKey)}</p>
        {/* 返回工作台入口，避免占位页面成为导航死路。 */}
        <Link
          className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
          to={ROUTE_PATHS.workspace}
        >
          {t('routes.back_to_workspace')}
        </Link>
      </section>
    </main>
  );
}
