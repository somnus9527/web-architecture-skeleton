import type { MetadataRoute } from 'next';

import { SUPPORTED_LOCALES } from '@/i18n/locale-config';
import { getPublicConfig } from '@/shared/config/public-config';
import { localizedPath } from '@/shared/i18n/public-locale-routing';
import { listLocalizedIndexableRoutes } from '@/shared/navigation/public-route-visibility';
import { buildHreflangLanguages } from '@/shared/seo/public-locale-metadata';

/**
 * sitemap：只列可索引的公开语言路由，每个路由 × 语言数各一条，每条带 `alternates.languages`。
 *
 * 不列工具区、`noindex` 页，也不列根路径 `/`（它是 308 出口，不是最终 URL）。条目由
 * `public-route-visibility.ts` 登记表驱动，新增公开页只需登记一次。
 *
 * @returns sitemap 条目。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const { appOrigin } = getPublicConfig();

  return listLocalizedIndexableRoutes().flatMap((route) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: `${appOrigin}${localizedPath(locale, route.path)}`,
      alternates: { languages: buildHreflangLanguages(route.path, appOrigin) },
    })),
  );
}
