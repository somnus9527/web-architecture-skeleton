import type { MetadataRoute } from 'next';

import { getPublicConfig } from '@/shared/config/public-config';
import { PRIVATE_ROUTE_PREFIXES } from '@/shared/navigation/public-route-visibility';

/**
 * robots：允许公开区，屏蔽认证区、工具区与 Next BFF 路径。
 *
 * 屏蔽清单来自 `public-route-visibility.ts` 登记表，避免与 proxy、sitemap 漂移；不屏蔽任何语言前缀
 * （`/zh-CN`、`/en-US` 都是可索引的公开 URL）。
 *
 * @returns robots 规则。
 */
export default function robots(): MetadataRoute.Robots {
  const { appOrigin } = getPublicConfig();

  return {
    rules: {
      userAgent: '*',
      disallow: [...PRIVATE_ROUTE_PREFIXES],
    },
    sitemap: `${appOrigin}/sitemap.xml`,
  };
}
