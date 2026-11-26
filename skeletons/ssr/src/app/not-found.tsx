import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { LinkButton } from '@/shared/ui';
import { localizedPath, toLocaleCode } from '@/shared/i18n/public-locale-routing';

/**
 * 404 文档的 title：不设的话会继承根 layout 的站点名，比「页面未找到」更不像 404。
 *
 * @returns 404 页 Metadata。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('errors.pages.notFound');

  return { title: t('title') };
}

/**
 * 根级 404 页（Server Component）：承运路由层未命中。
 *
 * 路由层未命中会渲染合成路由 `/_not-found`，Next 在这里套上根 layout，`<html lang>` 与应用样式表都由
 * 根 layout 提供；`noindex` 由 Next 按 404 状态码自动注入。
 *
 * @returns 未找到提示与返回公开首页链接。
 */
export default async function NotFound() {
  const locale = toLocaleCode(await getLocale());
  const t = await getTranslations('errors.pages.notFound');

  return (
    <main className="center-page">
      <section className="center-card">
        <p className="center-card__code">404</p>
        <h1 className="center-card__title">{t('title')}</h1>
        <p className="center-card__description">{t('description')}</p>
        <div className="center-card__action">
          <LinkButton href={localizedPath(locale, '/')} hrefLang={locale}>
            {t('backHome')}
          </LinkButton>
        </div>
      </section>
    </main>
  );
}
