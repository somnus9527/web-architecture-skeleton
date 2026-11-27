/**
 * BFF 错误码目录：BFF 自产码与需要识别的后端鉴权码。
 *
 * 命名规则：`dot.snake_case`。BFF 响应体的 `code` 会下发给浏览器，前端只按码判断（401 清理会话），
 * 不依赖具体字符串；新增码先登记再使用，`pnpm check:error-codes` 会校验裸字面量与 `docs/error-codes.md`。
 */
export interface IErrorCodeMeta {
  /** 响应体里的 `code` 值。 */
  code: string;
  /** 期望的 HTTP 状态。 */
  httpStatus: number;
  /** 码的归属方。 */
  owner: 'bff' | 'backend';
  /** 用户可见文案的 locale key；BFF 响应码由 codeMsg 承载文案，这里为 null。 */
  messageKey: string | null;
  /** 一句话说明触发场景。 */
  summary: string;
}

/**
 * 后端统一信封的成功码。
 */
export const SUCCESS_CODE = '200' as const;

export const ERROR_CODES = {
  BFF_UPSTREAM_FAILED: {
    code: 'bff.upstream_failed',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: '上游返回非 2xx 或业务码非成功',
  },
  BFF_UNEXPECTED_JSON_RESPONSE: {
    code: 'bff.unexpected_json_response',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: '二进制端点收到 JSON（可能是上游错误页）',
  },
  BFF_TIMEOUT: {
    code: 'bff.timeout',
    httpStatus: 504,
    owner: 'bff',
    messageKey: null,
    summary: '上游请求超时',
  },
  BFF_NETWORK_ERROR: {
    code: 'bff.network_error',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: 'BFF 出站网络失败',
  },
  BFF_ABORTED: {
    code: 'bff.aborted',
    httpStatus: 499,
    owner: 'bff',
    messageKey: null,
    summary: '请求被取消（客户端断开）',
  },
  BFF_MALFORMED_WRAPPER: {
    code: 'bff.malformed_wrapper',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: '响应缺少 { data, code, codeMsg } 信封',
  },
  BFF_MALFORMED_DATA: {
    code: 'bff.malformed_data',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: '响应 data 形状不符合 DTO 契约',
  },
  BFF_JSON_PARSE_ERROR: {
    code: 'bff.json_parse_error',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: '响应体不是合法 JSON',
  },
  BFF_INVALID_GATEWAY_PATH: {
    code: 'bff.invalid_gateway_path',
    httpStatus: 500,
    owner: 'bff',
    messageKey: null,
    summary: '出站路径未通过 resolveOutboundUrl 校验',
  },
  BFF_EMPTY_DATA: {
    code: 'bff.empty_data',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: 'data 为空但端点声明必填',
  },
  BFF_BINARY_RESPONSE: {
    code: 'bff.binary_response',
    httpStatus: 502,
    owner: 'bff',
    messageKey: null,
    summary: '期望 JSON 却收到二进制响应',
  },
  BFF_INTERNAL_ERROR: {
    code: 'bff.internal_error',
    httpStatus: 500,
    owner: 'bff',
    messageKey: null,
    summary: '未归类异常，响应不带堆栈',
  },
  AUTH_SESSION_EXPIRED: {
    code: 'auth.session_expired',
    httpStatus: 401,
    owner: 'backend',
    messageKey: null,
    summary: '后端下发的登录态失效码，BFF 归一为 401',
  },
  AUTH_SESSION_REQUIRED: {
    code: 'auth.session_required',
    httpStatus: 401,
    owner: 'bff',
    messageKey: null,
    summary: '请求缺少会话 cookie',
  },
} as const satisfies Record<string, IErrorCodeMeta>;

/**
 * 已登记的 error code 联合类型。
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]['code'];
