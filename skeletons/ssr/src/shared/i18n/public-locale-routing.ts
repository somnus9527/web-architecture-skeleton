import { DEFAULT_PUBLIC_URL_LOCALE, SUPPORTED_LOCALES, isLocaleCode, type LocaleCode } from '@/i18n/locale-config';

/**
 * 参与公开页语言路由的 URL locale 列表。
 *
 * URL 使用与内部 locale 相同的全码，因此不需要维护 URL 短码与内部 locale 的映射表。
 */
export const URL_LOCALES = SUPPORTED_LOCALES;

/**
 * 把任意语言信号收敛为受支持的 locale，供客户端切换控件与 metadata 做类型安全兜底。
 *
 * 非法段值最终由 `[locale]/layout.tsx` 的 `notFound()` 处理，这里只保证不产出非法 URL。
 *
 * @param value - 候选 locale（路由段、provider locale 等）。
 * @returns 受支持的 locale。
 */
export function toLocaleCode(value: string | undefined): LocaleCode {
  return isLocaleCode(value) ? value : DEFAULT_PUBLIC_URL_LOCALE;
}

/**
 * 解析路径首段是否为受支持的 URL locale。
 *
 * 只按段边界匹配：`/zh-CNfoo` 的前缀不是合法 locale。
 *
 * @param pathname - 当前请求路径。
 * @returns 首段对应的 locale；无合法前缀时返回 undefined。
 */
export function resolveUrlLocale(pathname: string): LocaleCode | undefined {
  const [firstSegment] = pathname.split('/').filter(Boolean);
  return isLocaleCode(firstSegment) ? firstSegment : undefined;
}

/**
 * 剥离语言前缀，返回剩余路径（根为 `'/'`）。
 *
 * @param pathname - 当前请求路径。
 * @returns 去掉语言前缀后的路径；无合法前缀时返回 undefined。
 */
export function stripUrlLocale(pathname: string): string | undefined {
  const locale = resolveUrlLocale(pathname);
  if (!locale) {
    return undefined;
  }

  const remainder = pathname.slice(locale.length + 1);
  return remainder === '' ? '/' : remainder;
}

/**
 * 拼接带语言前缀的公开路径。
 *
 * @param locale - 目标 locale。
 * @param path - 不含语言前缀的公开路径，默认根路径。
 * @returns 带语言前缀的绝对路径。
 */
export function localizedPath(locale: LocaleCode, path = '/'): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`;
}

/**
 * 公开页语言切换：把当前路径的语言前缀换成目标语言。
 *
 * @param pathname - 当前路径（可含语言前缀）。
 * @param nextLocale - 目标 locale。
 * @returns 切换语言后的路径。
 */
export function swapPathLocale(pathname: string, nextLocale: LocaleCode): string {
  const remainder = stripUrlLocale(pathname);
  return localizedPath(nextLocale, remainder ?? pathname);
}
