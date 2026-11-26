import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getServerConfig } from '@/bff/shared/server-config';

export const dynamic = 'force-dynamic';

/**
 * 登录后工具区占位页。只验证 cookie 存在性，不把 token 暴露给 UI。
 *
 * @returns 认证区占位内容。
 */
export default async function ShowcaseConsolePage() {
  const config = getServerConfig();
  const cookieStore = await cookies();

  if (!cookieStore.get(config.sessionCookieName)?.value) {
    redirect('/login');
  }

  const t = await getTranslations('console');

  return (
    <main className="public-page">
      <div className="public-page__header">
        <div>
          <h1 className="public-page__title">{t('title')}</h1>
          <p className="public-page__subtitle">{t('description')}</p>
        </div>
      </div>
    </main>
  );
}
