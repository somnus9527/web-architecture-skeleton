/**
 * Edge / middleware 运行时可读的配置访问器。
 *
 * 只在这里读取 `process.env`，业务与 proxy 代码通过函数获取已校验的值，避免散读。
 */

const DEFAULT_ALLOWED_ORIGIN = 'http://127.0.0.1:3001';

/**
 * 读取并校验 CORS allowlist 的站点 origin。
 *
 * @returns 规范化后的 http(s) origin。
 */
export function readAllowedOrigin(): string {
  const rawValue = process.env.APP_ORIGIN?.trim();

  if (!rawValue) {
    return DEFAULT_ALLOWED_ORIGIN;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    throw new Error('APP_ORIGIN must be a valid absolute URL.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('APP_ORIGIN must use http or https.');
  }

  return parsedUrl.origin;
}
