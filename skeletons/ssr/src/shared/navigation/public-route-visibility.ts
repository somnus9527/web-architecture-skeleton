/**
 * 公开区路由登记表：SEO 与语言路由的唯一事实源。
 *
 * 三个正交维度必须逐条显式声明，不得互相推导：
 * - 匿名可访问性由路由归属的 layout / 页面自行保证（本表不表达鉴权）；
 * - `indexable` 决定是否进 sitemap；
 * - `localeRouting` 决定 proxy 是否为其注入 URL 语言、是否生成多语言条目。
 *
 * 消费者：`src/proxy.ts`（受控 URL 语言头白名单）、`src/app/sitemap.ts`、`src/app/robots.ts`、
 * `src/test/architecture/public-locale-routing.test.ts`。新增公开页时必须同时满足这些消费者。
 */

/**
 * 单条公开区路由的可见性声明。
 */
export interface IPublicRouteVisibility {
  /**
   * 不含语言前缀的路由路径，根路径写 `'/'`。
   *
   * 不得包含 `.`：proxy matcher 排除了含点路径，含点的公开路径会绕过受控 URL 语言头。
   */
  path: string;
  /**
   * 是否可被搜索引擎索引（是否进入 sitemap）。
   */
  indexable: boolean;
  /**
   * 是否参与公开页语言路由（URL 是否带 `/zh-CN`、`/en-US` 前缀）。
   */
  localeRouting: boolean;
}

/**
 * 公开区路由登记。认证入口等「可收录但不做语言镜像」的路由不要写进来，
 * 它们的可索引性由自身 layout 的 `robots` metadata 表达。
 */
export const PUBLIC_ROUTE_VISIBILITY: readonly IPublicRouteVisibility[] = [
  { path: '/', indexable: true, localeRouting: true },
];

/**
 * 私有路由前缀：`robots.ts` 的屏蔽清单，也是架构测试断言不得出现语言前缀的范围。
 */
export const PRIVATE_ROUTE_PREFIXES: readonly string[] = ['/login', '/showcase-console', '/ssr-app-api/'];

/**
 * 参与语言路由且可索引的公开路由，供 `sitemap.ts` 生成多语言条目。
 *
 * @returns 已登记的公开语言路由。
 */
export function listLocalizedIndexableRoutes(): readonly IPublicRouteVisibility[] {
  return PUBLIC_ROUTE_VISIBILITY.filter((route) => route.localeRouting && route.indexable);
}

/**
 * 判断「去掉语言前缀后」的路径是否为已登记的公开语言路由（含其子路径）。
 *
 * @param pathWithoutLocale - 已剥离语言前缀的路径，根路径为 `'/'`。
 * @returns 该路径是否属于受控的公开语言路由。
 */
export function isLocalizedPublicPath(pathWithoutLocale: string): boolean {
  const normalized = normalizePath(pathWithoutLocale);
  return PUBLIC_ROUTE_VISIBILITY.some((route) => route.localeRouting && matchesRoute(normalized, route.path));
}

/**
 * 归一化尾斜杠，避免 `/zh-CN/` 与 `/zh-CN` 判定不一致。
 *
 * @param pathname - 待归一化路径。
 * @returns 不含尾斜杠的路径（根路径仍为 `'/'`）。
 */
function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * 路径匹配：登记为 `'/'` 时只匹配根路径，否则匹配自身及其子路径。
 *
 * @param pathname - 已归一化路径。
 * @param routePath - 登记表中的路由路径。
 * @returns 是否命中该登记路由。
 */
function matchesRoute(pathname: string, routePath: string): boolean {
  if (routePath === '/') {
    return pathname === '/';
  }

  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}
