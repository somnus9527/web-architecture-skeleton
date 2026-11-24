/**
 * 浏览器 Cookie 写入选项。
 */
export interface ISetCookieOptions {
  path?: string;
  maxAge?: number;
  sameSite?: 'Lax' | 'Strict' | 'None';
  secure?: boolean;
}

/**
 * 读取浏览器端 Cookie。仅供 Client Component / 浏览器环境使用。
 *
 * @param name - Cookie 名称。
 * @returns Cookie 值；不存在或当前环境不可读时返回 undefined。
 */
export function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  if (!cookie) {
    return undefined;
  }

  return decodeURIComponent(cookie.slice(encodedName.length));
}

/**
 * 写入浏览器端 Cookie。无痕或禁用 Cookie 时浏览器可能静默失败，调用方按普通关闭流程处理。
 *
 * @param name - Cookie 名称。
 * @param value - Cookie 值。
 * @param options - Cookie 属性。
 */
export function setCookie(name: string, value: string, options: ISetCookieOptions = {}): void {
  if (typeof document === 'undefined') {
    return;
  }

  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  segments.push(`Path=${options.path ?? '/'}`);

  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${options.maxAge}`);
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  if (options.secure) {
    segments.push('Secure');
  }

  document.cookie = segments.join('; ');
}
