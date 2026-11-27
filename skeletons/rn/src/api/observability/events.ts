/**
 * RN 日志事件目录。
 *
 * 所有 `logger.*` 的首参必须取自这里；名字一旦发布就是可观测契约，改名要同步上报平台（Sentry/Crashlytics）
 * 与看板。命名规则：`dot.case`，段内允许下划线；禁止空格、大写与中文。
 */
export const LOG_EVENTS = {
  /** 发起 API 请求。 */
  API_REQUEST: 'api.request',
  /** API 响应返回（含状态与耗时）。 */
  API_RESPONSE: 'api.response',
  /** 请求失败（网络、HTTP 或解析）。 */
  API_ERROR: 'api.error',
  /** 首页响应信封不符合 { data, code, codeMsg } 契约。 */
  HOME_ENVELOPE_REJECTED: 'home.envelope.rejected',
} as const;

/**
 * 已登记的事件名联合类型。
 */
export type LogEventName = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
