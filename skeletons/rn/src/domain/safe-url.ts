import { ALLOWED_EXTERNAL_HOST_SUFFIXES, ALLOWED_EXTERNAL_HOSTS, APP_DEEP_LINK_SCHEME } from './safe-url-config';

/**
 * 允许的协议白名单；自有 scheme 来自配置，避免规则代码硬编码。
 */
const ALLOWED_PROTOCOLS: readonly string[] = ['https:', 'mailto:', 'tel:', `${APP_DEEP_LINK_SCHEME}:`];

/**
 * 自有 scheme deep link 的解析结果。
 */
export interface IParsedAppLink {
  /** 路径部分。 */
  pathname: string;
  /** 查询参数。 */
  searchParams: URLSearchParams;
}

/**
 * 判断 URL 是否命中外部链接白名单；失败返回 false，不抛错。
 *
 * @param url - 待校验 URL。
 * @returns 是否允许打开。
 */
export function isAllowedUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return false;
  }

  if (parsed.protocol === 'https:') {
    const host = parsed.host.toLowerCase();
    if (ALLOWED_EXTERNAL_HOSTS.includes(host)) {
      return true;
    }

    return ALLOWED_EXTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  }

  return true;
}

/**
 * 判断图片 URL 是否允许加载：只接受 HTTPS。
 *
 * @param url - 图片 URL。
 * @returns 是否允许。
 */
export function isAllowedImageUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 校验 URL，不允许时抛错；用于必须拒绝的入口。
 *
 * @param url - 待校验 URL。
 * @throws Error 当 URL 不在白名单内。
 */
export function assertAllowedUrl(url: string): void {
  if (!isAllowedUrl(url)) {
    throw new Error(`URL not allowed: ${url}`);
  }
}

/**
 * 解析自有 scheme 的 deep link；scheme 不匹配或 URL 非法时返回 null。
 *
 * @param url - deep link。
 * @param appScheme - 项目 scheme，不含冒号。
 * @returns 路径与查询参数；不匹配时返回 null。
 */
export function parseAppLink(url: string, appScheme: string): IParsedAppLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${appScheme}:`) {
    return null;
  }

  return {
    pathname: parsed.pathname || `/${parsed.hostname}`,
    searchParams: parsed.searchParams,
  };
}
