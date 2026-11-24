import 'server-only';

import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import {
  LOCALE_COOKIE_NAME,
  NO_SIGNAL_FALLBACK_LOCALE,
  PUBLIC_LOCALE_HEADER,
  isLocaleCode,
  type LocaleCode,
} from './locale-config';

/**
 * 从 Accept-Language header 解析项目支持的 locale。
 *
 * 规则：命中的受支持 locale 原样返回；`zh*` → zh-CN、`en*` → en-US；
 * **无信号或无法匹配 → `NO_SIGNAL_FALLBACK_LOCALE`（en-US）**。
 *
 * 公开页语言由 URL 决定，本函数只负责链尾兜底。
 *
 * @param acceptLanguage - 浏览器传入的语言协商 header。
 * @returns 解析出的受支持 locale。
 */
function resolveAcceptLanguageLocale(acceptLanguage: string | null): LocaleCode {
  if (!acceptLanguage) {
    return NO_SIGNAL_FALLBACK_LOCALE;
  }

  const candidates = acceptLanguage.split(',').map((item) => item.trim().split(';')[0] ?? '');

  for (const candidate of candidates) {
    if (isLocaleCode(candidate)) {
      return candidate;
    }
    if (candidate.startsWith('zh')) {
      return 'zh-CN';
    }
    if (candidate.startsWith('en')) {
      return 'en-US';
    }
  }

  return NO_SIGNAL_FALLBACK_LOCALE;
}

/**
 * 按声明优先级解析请求 locale。
 *
 * 1. 显式 locale：`getTranslations({ locale })` 等 awaitable API 的覆盖值；
 * 2. `requestLocale`：`setRequestLocale()` 缓存或 next-intl 自家 middleware 头（骨架当前恒为空，保留通道）；
 * 3. `x-public-locale`：proxy 受控的 URL 语言，公开页的唯一权威；
 * 4. cookie：非公开页的用户偏好；
 * 5. Accept-Language；
 * 6. `NO_SIGNAL_FALLBACK_LOCALE`（en-US）。
 *
 * 惰性求值：命中 URL 语言后不再读取 cookie 与 Accept-Language。URL 必须压过 cookie——
 * 带其它语言 cookie 访问 `/zh-CN/**` 必须仍出中文。
 *
 * @param explicitLocale - next-intl 显式传入的 locale 覆盖值。
 * @param segmentLocale - next-intl `requestLocale` 解析结果。
 * @returns 当前请求使用的 locale。
 */
async function resolveRequestLocale(
  explicitLocale: string | undefined,
  segmentLocale: string | undefined,
): Promise<LocaleCode> {
  if (isLocaleCode(explicitLocale)) {
    return explicitLocale;
  }

  if (isLocaleCode(segmentLocale)) {
    return segmentLocale;
  }

  const headersList = await headers();
  const urlLocale = headersList.get(PUBLIC_LOCALE_HEADER) ?? undefined;
  if (isLocaleCode(urlLocale)) {
    return urlLocale;
  }

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (isLocaleCode(cookieLocale)) {
    return cookieLocale;
  }

  return resolveAcceptLanguageLocale(headersList.get('accept-language'));
}

/**
 * next-intl 请求配置：解析 locale 并加载对应文案字典。
 *
 * 公开页的 URL 语言经 proxy 注入的受控请求头进入，因此根 layout 的 `<html lang>`、站点级 metadata 与
 * `[locale]` 子树看到同一语言；非公开页继续走 cookie → Accept-Language → 无信号兜底语言（en-US）。
 */
export default getRequestConfig(async ({ locale, requestLocale }) => {
  const requestLocaleValue = await requestLocale;
  const resolvedLocale = await resolveRequestLocale(locale, requestLocaleValue);

  return {
    locale: resolvedLocale,
    messages: (await import(`../locale/${resolvedLocale}.json`)).default,
  };
});
