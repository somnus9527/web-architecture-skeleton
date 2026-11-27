/**
 * SSR 日志事件目录（服务端与客户端共用一个命名空间）。
 *
 * 所有 `serverLogger.*` / `clientLogger.*` 的首参必须取自这里；名字一旦发布就是可观测契约，
 * 改名要同步 SLS 告警与看板。命名规则：`dot.case`，段内允许下划线；禁止空格、大写与中文。
 */
export const LOG_EVENTS = {
  /** locale cookie 被拒绝（非法值）。 */
  LOCALE_COOKIE_REJECTED: 'locale.cookie.rejected',
  /** locale cookie 写入失败。 */
  LOCALE_COOKIE_FAILED: 'locale.cookie.failed',
  /** 语言切换请求被拒绝。 */
  LOCALE_SWITCH_REJECTED: 'locale.switch.rejected',
  /** 语言切换失败。 */
  LOCALE_SWITCH_FAILED: 'locale.switch.failed',
  /** 版本检查失败。 */
  FRONTEND_VERSION_CHECK_FAILED: 'frontend.version.check.failed',
  /** 版本接口缓存偏老，仍在可接受区间。 */
  FRONTEND_VERSION_CACHE_AGE: 'frontend.version.cache.age',
  /** 版本接口缓存存在串号或长期不刷新风险。 */
  FRONTEND_VERSION_CACHE_RISK: 'frontend.version.cache.risk',
  /** 版本接口响应体不符合契约。 */
  FRONTEND_VERSION_RESPONSE_INVALID: 'frontend.version.response.invalid',
  /** 版本检查不可用（网络或环境限制）。 */
  FRONTEND_VERSION_CHECK_UNAVAILABLE: 'frontend.version.check.unavailable',
  /** BFF 收到路由请求。 */
  BFF_ROUTE_REQUEST: 'bff.route.request',
  /** BFF 返回路由响应。 */
  BFF_ROUTE_RESPONSE: 'bff.route.response',
  /** 出站请求开始。 */
  BFF_UPSTREAM_REQUEST_STARTED: 'bff.upstream.request.started',
  /** 出站请求完成（含状态与耗时）。 */
  BFF_UPSTREAM_REQUEST_COMPLETED: 'bff.upstream.request.completed',
  /** 出站响应负载（debug，完整内容仅此处）。 */
  BFF_UPSTREAM_PAYLOAD: 'bff.upstream.payload',
  /** Server Action 开始。 */
  BFF_ACTION_STARTED: 'bff.action.started',
  /** Server Action 被拒绝（鉴权/校验失败）。 */
  BFF_ACTION_REJECTED: 'bff.action.rejected',
  /** Server Action 正常完成。 */
  BFF_ACTION_COMPLETED: 'bff.action.completed',
  /** refreshShowcaseAction 抛错。 */
  BFF_ACTION_REFRESH_SHOWCASE_FAILED: 'bff.action.refresh_showcase.failed',
  /** showcase 服务解析完成。 */
  SHOWCASE_SERVICE_RESOLVED: 'showcase.service.resolved',
  /** 首页依赖降级（部分数据缺失但页面可用）。 */
  SHOWCASE_HOME_DEPENDENCY_DEGRADED: 'showcase.home.dependency.degraded',
} as const;

/**
 * 已登记的事件名联合类型。
 */
export type LogEventName = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
