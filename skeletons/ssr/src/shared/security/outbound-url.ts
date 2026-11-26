import 'server-only';

/**
 * BFF 出站 URL 校验。
 *
 * 出站地址是 SSRF 的唯一入口：只要有一处拿用户可控片段拼 URL，就可能被指向内网或云 metadata。
 * 这里把「协议 + 同源 + 无 userinfo + 生产禁私网」四件事收在一个函数里，http-client 只能走它。
 */

/** 环回、私网、链路本地与云 metadata 的 host 判定。 */
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/u,
  /^127\./u,
  /^10\./u,
  /^192\.168\./u,
  /^172\.(?:1[6-9]|2\d|3[01])\./u,
  /^169\.254\./u,
  /^0\.0\.0\.0$/u,
  /^\[?::1\]?$/u,
  /^\[?f[cd][0-9a-f]{2}:/u,
  /\.local$/u,
  /^metadata\./u,
];

/** 校验选项。 */
export interface IOutboundUrlOptions {
  /** 是否允许私网/环回目标；mock 与本地开发为 true，生产必须 false。 */
  allowPrivateNetwork: boolean;
}

/**
 * 判断 host 是否落在私网/环回/链路本地范围。
 *
 * @param hostname - URL 的 hostname（小写、不含端口）。
 * @returns 是否属于非公网地址。
 */
export function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * 由 base URL 与相对 path 归并出站地址，并做安全检查。
 *
 * 为什么不能直接字符串拼接也不能裸 `new URL(path, base)`：
 * - 字符串拼接挡住 `//evil.com`，但挡不住 base 自带尾斜杠时的大小写/编码绕过，也不校验协议；
 * - `new URL('//evil.com', base)` 会直接换 host，是最典型的逃逸写法。
 * 因此归并后**必须再断言同源**。
 *
 * @param baseUrl - 配置里的后端或 mock 基址。
 * @param path - gateway 传入的相对路径。
 * @param options - 是否允许私网目标。
 * @returns 可安全 fetch 的绝对地址。
 * @throws Error 协议非法、跨源、带 userinfo 或（生产）指向私网时抛出。
 */
export function resolveOutboundUrl(baseUrl: string, path: string, options: IOutboundUrlOptions): string {
  const base = parseBaseUrl(baseUrl);
  const resolved = new URL(path, base);

  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error(`Outbound URL protocol is not allowed: ${resolved.protocol}`);
  }
  if (resolved.origin !== base.origin) {
    throw new Error(`Outbound URL must stay on the configured origin, got ${resolved.origin}`);
  }
  if (resolved.username || resolved.password) {
    throw new Error('Outbound URL must not carry credentials.');
  }
  if (!options.allowPrivateNetwork && isPrivateHostname(resolved.hostname)) {
    throw new Error(`Outbound URL points to a private network host: ${resolved.hostname}`);
  }

  return resolved.toString();
}

/**
 * 解析并校验 base URL。
 *
 * @param baseUrl - 原始基址。
 * @returns 解析后的 URL。
 * @throws Error 基址缺失或协议非法时抛出。
 */
function parseBaseUrl(baseUrl: string): URL {
  if (!baseUrl) {
    throw new Error('Outbound base URL is not configured.');
  }

  const base = new URL(baseUrl);
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error(`Outbound base URL protocol is not allowed: ${base.protocol}`);
  }

  return base;
}
