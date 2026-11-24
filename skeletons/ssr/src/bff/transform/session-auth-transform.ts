import 'server-only';

const SESSION_EXPIRED_BUSINESS_CODES = new Set(['AUTH_001', '401']);

/**
 * 归一化的鉴权失败，由 route facade 翻译为 401/403 稳定响应。
 */
export class BffAuthError extends Error {
  readonly status: 401 | 403;
  readonly code: string;
  readonly codeMsg: string;

  constructor(status: 401 | 403, code: string, codeMsg: string) {
    super(codeMsg);
    this.name = 'BffAuthError';
    this.status = status;
    this.code = code;
    this.codeMsg = codeMsg;
  }
}

/**
 * 判断后端业务错误码是否表示登录态失效。
 *
 * @param code - 后端统一响应信封中的业务码。
 * @returns 命中登录态失效码时返回 true。
 */
export function isSessionExpiredBusinessCode(code: string): boolean {
  return SESSION_EXPIRED_BUSINESS_CODES.has(code);
}

/**
 * 将后端登录态失效业务错误归一为 BFF 鉴权错误。
 *
 * @param codeMsg - 后端返回的安全提示文案。
 * @returns 统一 401 登录态失效错误。
 */
export function createSessionExpiredAuthError(codeMsg: string | null | undefined): BffAuthError {
  return new BffAuthError(401, 'session_expired', codeMsg?.trim() || 'Session expired.');
}

/**
 * 转发给后端的鉴权头。浏览器 httpOnly cookie 绝不原样透传，只转成 Authorization。
 */
export interface IBackendAuthHeaders {
  authorization: string;
  xUserType: string;
}

/**
 * 从 Cookie header 中解析目标会话 cookie 的值。
 *
 * 用 `indexOf('=')` + `slice` 而非 `split('=')`，避免 base64/JWT 值尾部的 `=` 被截断。
 *
 * @param cookieHeader - 原始 Cookie 请求头。
 * @param cookieName - 目标会话 cookie 名。
 * @returns cookie 值，不存在时 undefined。
 */
function readCookieValue(cookieHeader: string | null, cookieName: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    if (trimmed.slice(0, separatorIndex) === cookieName) {
      return trimmed.slice(separatorIndex + 1);
    }
  }

  return undefined;
}

/**
 * 从请求头提取同源会话 cookie，转换为后端鉴权头。
 *
 * @param requestHeaders - 当前请求头。
 * @param sessionCookieName - 会话 cookie 名（来自 server config）。
 * @returns 后端鉴权头。
 * @throws BffAuthError 会话 cookie 缺失时抛 401。
 */
export function buildBackendAuthHeaders(requestHeaders: Headers, sessionCookieName: string): IBackendAuthHeaders {
  const token = readCookieValue(requestHeaders.get('cookie'), sessionCookieName);

  if (!token) {
    throw new BffAuthError(401, 'session_required', 'Session cookie is required.');
  }

  return {
    authorization: `Bearer ${token}`,
    xUserType: 'web-session',
  };
}
