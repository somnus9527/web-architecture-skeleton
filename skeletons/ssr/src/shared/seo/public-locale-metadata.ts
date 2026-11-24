import type { Metadata } from 'next';

import { DEFAULT_PUBLIC_URL_LOCALE, SUPPORTED_LOCALES, type LocaleCode } from '@/i18n/locale-config';
import { localizedPath } from '@/shared/i18n/public-locale-routing';
import { OG_IMAGE_PATH, OG_IMAGE_SIZE, OG_IMAGE_TYPE } from '@/shared/seo/og-image';

/**
 * Open Graph 语言使用下划线格式，是 URL locale 之外唯一需要的一张映射表。
 */
export const OG_LOCALE: Record<LocaleCode, string> = {
  'zh-CN': 'zh_CN',
  'en-US': 'en_US',
};

/**
 * hreflang `x-default` 的目标语言，必须与根路径 308 的目标一致。
 */
export const X_DEFAULT_LOCALE = DEFAULT_PUBLIC_URL_LOCALE;

/**
 * 构造公开页的绝对地址（canonical / hreflang / sitemap 共用）。
 *
 * @param appOrigin - 站点 origin，取自公开配置。
 * @param locale - 目标语言。
 * @param path - 不含语言前缀的公开路径。
 * @returns 绝对 URL。
 */
export function buildPublicAbsoluteUrl(appOrigin: string, locale: LocaleCode, path = '/'): string {
  return `${appOrigin}${localizedPath(locale, path)}`;
}

/**
 * 构造某公开路径的 hreflang 语言表：每个受支持语言 + `x-default`。
 *
 * 由登记表驱动的单一 helper 生成，因此各语言页面之间天然互指，与 sitemap 的 alternates 也保持一致。
 *
 * @param path - 不含语言前缀的公开路径。
 * @param appOrigin - 站点 origin。
 * @returns hreflang 语言到绝对 URL 的映射。
 */
export function buildHreflangLanguages(path: string, appOrigin: string): Record<LocaleCode | 'x-default', string> {
  const languages = {} as Record<LocaleCode | 'x-default', string>;

  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = buildPublicAbsoluteUrl(appOrigin, locale, path);
  }

  languages['x-default'] = buildPublicAbsoluteUrl(appOrigin, X_DEFAULT_LOCALE, path);
  return languages;
}

/**
 * 构造公开页的 `alternates`：自指 canonical + 互指 hreflang + `x-default`。
 *
 * @param input - 当前语言、不含语言前缀的路径与站点 origin。
 * @returns Next Metadata 的 `alternates` 字段。
 */
export function buildPublicAlternates(input: {
  locale: LocaleCode;
  path?: string;
  appOrigin: string;
}): Metadata['alternates'] {
  const path = input.path ?? '/';

  return {
    canonical: buildPublicAbsoluteUrl(input.appOrigin, input.locale, path),
    languages: buildHreflangLanguages(path, input.appOrigin),
  };
}

/**
 * 构造公开页的完整 `openGraph`,涵盖站点级字段、语言字段与图片。
 *
 * **为什么必须一次性给全**:Next 的 metadata 是**逐字段覆盖、`openGraph` 整块替换、不深合并**,而
 * `src/app/opengraph-image.tsx` 这类文件约定图片只在**声明它的那一段**(根段)注入。公开页为了按 URL
 * 语言输出 `og:locale` 而自己声明 `openGraph`,根 layout 的 `type`/`siteName` 与文件约定注入的
 * `images` 会被整块**静默替换掉**——页面照样输出 `twitter:card: summary_large_image`,却没有图。
 * 因此公开页一律走本 helper,不得手写只含 `title`/`description`/`locale` 的 `openGraph`
 * (回归防线见 `src/test/architecture/seo-boundary.test.ts`)。
 *
 * @param input - 当前语言、路径、站点 origin、站点名、页面 title/description 与图片替代文本。
 * @returns Next Metadata 的 `openGraph` 字段;`images` 指向 `OG_IMAGE_PATH`,尺寸/类型与图片本体同源。
 */
export function buildPublicOpenGraph(input: {
  locale: LocaleCode;
  appOrigin: string;
  siteName: string;
  title: string;
  description: string;
  path?: string;
  imageAlt?: string;
}): Metadata['openGraph'] {
  const path = input.path ?? '/';

  return {
    type: 'website',
    siteName: input.siteName,
    title: input.title,
    description: input.description,
    url: buildPublicAbsoluteUrl(input.appOrigin, input.locale, path),
    ...buildPublicOpenGraphLocales(input.locale),
    images: [
      {
        url: `${input.appOrigin}${OG_IMAGE_PATH}`,
        width: OG_IMAGE_SIZE.width,
        height: OG_IMAGE_SIZE.height,
        alt: input.imageAlt ?? input.siteName,
        type: OG_IMAGE_TYPE,
      },
    ],
  };
}

/**
 * 构造公开页的 `openGraph.locale` 与 `alternateLocale`。
 *
 * @param locale - 当前语言。
 * @returns openGraph 语言字段。
 */
export function buildPublicOpenGraphLocales(locale: LocaleCode): { locale: string; alternateLocale: string[] } {
  return {
    locale: OG_LOCALE[locale],
    alternateLocale: SUPPORTED_LOCALES.filter((item) => item !== locale).map((item) => OG_LOCALE[item]),
  };
}
