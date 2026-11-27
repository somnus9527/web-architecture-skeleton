/**
 * 前端日志事件目录。
 *
 * 所有 `logger.*` 的首参必须取自这里；名字一旦发布就是可观测契约，改名要同步 SLS 告警与看板。
 * 命名规则：`dot.case`，段内允许下划线；禁止空格、大写与中文。
 */
export const LOG_EVENTS = {
  /** 请求整体失败（网络层或未归类的异常）。 */
  API_REQUEST_FAILED: 'api.request.failed',
  /** 会话被服务端拒绝（401/403）。 */
  API_SESSION_REJECTED: 'api.session.rejected',
  /** 登录失败。 */
  AUTH_LOGIN_FAILED: 'auth.login.failed',
  /** 登出失败。 */
  AUTH_LOGOUT_FAILED: 'auth.logout.failed',
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
  /** ErrorBoundary 捕获到渲染异常。 */
  REACT_ERROR_BOUNDARY_CAUGHT: 'react.error_boundary.caught',
  /** 工作台数据加载失败。 */
  WORKSPACE_DASHBOARD_LOAD_FAILED: 'workspace.dashboard.load.failed',
  /** 工作台推进订单状态失败。 */
  WORKSPACE_ORDER_ADVANCE_FAILED: 'workspace.order.advance.failed',
} as const;

/**
 * 已登记的事件名联合类型。
 */
export type LogEventName = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
