import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

import { LocaleSwitcher } from '@/features/locale-switcher/locale-switcher';
import { ThemeToggleClient } from '@/features/theme/theme-toggle';
import { localizedPath, toLocaleCode } from '@/shared/i18n/public-locale-routing';

/**
 * 受控登录占位页，不伪造真实认证能力。
 *
 * 非公开区语言切换保持 cookie + `router.refresh()`（URL 不带语言前缀）；返回首页链接直接指向当前
 * 语言 URL，避免多一次 308 跳转或语言跳变。
 *
 * @returns 登录占位内容。
 */
export default async function LoginPage() {
  const t = await getTranslations('auth');
  const locale = toLocaleCode(await getLocale());

  return (
    <main className="public-page">
      <div className="public-page__header">
        <div>
          <h1 className="public-page__title">{t('title')}</h1>
          <p className="public-page__subtitle">{t('description')}</p>
        </div>
        <div className="public-page__actions">
          <ThemeToggleClient />
          <LocaleSwitcher />
        </div>
      </div>
      <div className="public-page__body">
        <Link className="text-link" href={localizedPath(locale, '/')} hrefLang={locale}>
          {t('backHome')}
        </Link>
      </div>
    </main>
  );
}
