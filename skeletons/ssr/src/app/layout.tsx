import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

import { AppProviders } from './providers';

import { validateServerConfig } from '@/bff/shared/server-config';
import { getDeploymentVersion } from '@/shared/config/deployment-version';
import { getPublicConfig } from '@/shared/config/public-config';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/900.css';
import './globals.css';

/**
 * 站点级 metadata。title 走 i18n（不硬编码站名）；metadataBase 取自公开配置。
 *
 * 不设 `openGraph.locale`：语言相关的 OG 字段由公开页 metadata 按 URL 语言提供，
 * 在这里硬编码单一语言会让 `/zh-CN` 页面输出英文 OG 语言。
 *
 * @returns Next Metadata。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  const { appOrigin } = getPublicConfig();

  return {
    metadataBase: new URL(appOrigin),
    applicationName: t('siteName'),
    title: {
      default: t('siteName'),
      template: `%s | ${t('siteName')}`,
    },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: t('siteName'),
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

/**
 * 根布局。首行 fail-fast 校验服务端配置，再装配 locale、Provider 与全局 provider。
 *
 * @param props - 子路由内容。
 * @returns 根 HTML 文档。
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  validateServerConfig();

  const locale = await getLocale();
  const messages = await getMessages();
  const currentReleaseId = process.env.NODE_ENV === 'production' ? getDeploymentVersion() : undefined;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <AppProviders currentReleaseId={currentReleaseId}>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <div className="page-shell">{children}</div>
          </NextIntlClientProvider>
        </AppProviders>
      </body>
    </html>
  );
}
