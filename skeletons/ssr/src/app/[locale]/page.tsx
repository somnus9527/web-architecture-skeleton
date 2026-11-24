import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';

import { getShowcaseListForHomeService } from '@/bff/services/showcase-service';
import { createRequestContext } from '@/bff/shared/request-context';
import { ShowcasePage } from '@/features/showcase/showcase-page';
import { SUPPORTED_LOCALES } from '@/i18n/locale-config';
import { getPublicConfig } from '@/shared/config/public-config';
import { assertPublicLocaleSegment } from '@/shared/i18n/public-locale-guard';
import { toLocaleCode } from '@/shared/i18n/public-locale-routing';
import { buildPublicAlternates, buildPublicOpenGraph } from '@/shared/seo/public-locale-metadata';

/**
 * 公开语言段的静态参数：声明受支持的语言段。URL locale 使用全码、与内部 locale 同名，因此没有映射表。
 *
 * 这里**不**导出 `dynamicParams = false`：`/[locale]` 因根 layout 读取请求上下文而是动态路由，Next 不为
 * 它产出静态路径 / fallback 表，该导出放在 layout 或 page 上都不产生路由层拒绝——含点路径照样渲染成
 * 200 + 整页首页。未登记语言段的 404 由 `src/proxy.ts`（首段不是合法语言码 → 改写成匹配不到路由的路径，
 * 落回 routing 层 404 与根级 `src/app/not-found.tsx`）与 `assertPublicLocaleSegment()`（兜 proxy matcher
 * 看不见的含点路径）两条链共同承担。将来 `[locale]` 若改为可预渲染（多 root layout 路线），才需要重新
 * 评估这个导出。
 *
 * @returns 受支持 locale 对应的段参数。
 */
export function generateStaticParams(): Array<{ locale: string }> {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

/**
 * 公开首页 metadata：页面专属 title/description + 自指 canonical + hreflang + 完整 OG（含卡片图）。
 *
 * 文案按 URL 语言显式取字典，因此不依赖请求解析链也能保证 title 与 URL 语言一致。
 *
 * `openGraph` 必须整体由 `buildPublicOpenGraph()` 产出：Next 对 `openGraph` 是整块替换，只写
 * `title`/`description`/`locale` 会把根 layout 的 `type`/`siteName` 与文件约定图片一起抹掉（卡片变无图）。
 *
 * @param props - 当前语言段参数。
 * @returns 首页 Metadata。
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const urlLocale = toLocaleCode(locale);
  const { appOrigin } = getPublicConfig();
  const t = await getTranslations({ locale: urlLocale, namespace: 'metadata.home' });
  const tSite = await getTranslations({ locale: urlLocale, namespace: 'metadata' });
  const title = t('title');
  const description = t('description');

  return {
    title: { absolute: title },
    description,
    alternates: buildPublicAlternates({ locale: urlLocale, path: '/', appOrigin }),
    openGraph: buildPublicOpenGraph({
      locale: urlLocale,
      appOrigin,
      siteName: tSite('siteName'),
      title,
      description,
      path: '/',
    }),
  };
}

/**
 * 公开首页：服务端读取 showcase 数据并直出 HTML。
 *
 * 语言来自 URL 语言段（经 proxy 受控头进入 request locale context），因此 `/zh-CN` 与 `/en-US`
 * 各自直出对应语言的 HTML。
 *
 * 首段不是受支持语言时先 404：`/wp-login.php`、`/fr.js` 这类含点路径被 proxy matcher 排除，proxy 看不见
 * 它们，会直接落到本页——不拦就会以兜底语言渲染出 200 首页（软 404 / 重复内容）。**新增公开页必须在渲染
 * 入口调用同一个守卫**，由 `src/test/architecture/public-locale-routing.test.ts` 静态扫描强制。
 *
 * @param props - 当前语言段参数。
 * @returns 公开 SSR 页面。
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: urlLocale } = await params;
  assertPublicLocaleSegment(urlLocale);

  const locale = await getLocale();
  const requestHeaders = await headers();
  const model = await getShowcaseListForHomeService(createRequestContext(requestHeaders, locale));

  return <ShowcasePage model={model} />;
}
