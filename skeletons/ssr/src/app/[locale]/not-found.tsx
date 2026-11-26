import { getLocale, getTranslations } from 'next-intl/server';

import { LinkButton } from '@/shared/ui';
import { localizedPath, toLocaleCode } from '@/shared/i18n/public-locale-routing';

/**
 * 公开区 404 页（Server Component）。
 *
 * 落在语言段内，文案与返回首页链接都跟随 URL 语言；不经过 308 跳转，也不切语言。
 *
 * @returns 未找到提示与返回当前语言首页链接。
 */
export default async function PublicNotFound() {
  const urlLocale = toLocaleCode(await getLocale());
  const t = await getTranslations('errors.pages.notFound');

  return (
    <main className="center-page">
      <section className="center-card">
        <p className="center-card__code">404</p>
        <h1 className="center-card__title">{t('title')}</h1>
        <p className="center-card__description">{t('description')}</p>
        <div className="center-card__action">
          <LinkButton href={localizedPath(urlLocale, '/')} hrefLang={urlLocale}>
            {t('backHome')}
          </LinkButton>
        </div>
      </section>
    </main>
  );
}
