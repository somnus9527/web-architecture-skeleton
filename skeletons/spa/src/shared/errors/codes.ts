/**
 * 错误码目录：前端自产码与需要识别的后端码都在这里登记。
 *
 * 命名规则：`dot.snake_case`（`common.network_error`、`auth.session_expired`）。新增码先登记再使用，
 * `pnpm check:error-codes` 会校验源码里的裸字面量与 `docs/error-codes.md` 是否同步。
 */
export interface IErrorCodeMeta {
  /** 响应体里的 `code` 值。 */
  code: string;
  /** 期望的 HTTP 状态；网络层错误为 null。 */
  httpStatus: number | null;
  /** 码的归属方，决定谁能改它。 */
  owner: 'frontend' | 'bff' | 'backend';
  /** 用户可见文案的 locale key；API 级错误（无页面文案）为 null。 */
  messageKey: string | null;
  /** 一句话说明触发场景。 */
  summary: string;
}

/**
 * 后端统一信封的成功码。
 */
export const SUCCESS_CODE = '200' as const;

export const ERROR_CODES = {
  COMMON_HTTP_ERROR: {
    code: 'common.http_error',
    httpStatus: null,
    owner: 'frontend',
    messageKey: 'api.error.http',
    summary: 'HTTP 非 2xx 且响应体没有可读信封',
  },
  COMMON_INVALID_RESPONSE: {
    code: 'common.invalid_response',
    httpStatus: null,
    owner: 'frontend',
    messageKey: 'api.error.invalid_response',
    summary: '响应体不符合 { data, code, codeMsg } 信封契约',
  },
  COMMON_NETWORK_ERROR: {
    code: 'common.network_error',
    httpStatus: null,
    owner: 'frontend',
    messageKey: 'api.error.network',
    summary: '浏览器网络层失败（fetch 拒绝或离线）',
  },
  AUTH_SESSION_EXPIRED: {
    code: 'auth.session_expired',
    httpStatus: 401,
    owner: 'backend',
    messageKey: 'api.error.session_expired',
    summary: '后端下发的登录态失效码，前端据此清理内存态并跳登录',
  },
} as const satisfies Record<string, IErrorCodeMeta>;

/**
 * 已登记的 error code 联合类型。
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]['code'];
