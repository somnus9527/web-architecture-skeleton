'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { setLocaleAction } from '@/bff/actions/locale-actions';
import { SUPPORTED_LOCALES, type LocaleCode } from '@/i18n/locale-config';
import { swapPathLocale, toLocaleCode } from '@/shared/i18n/public-locale-routing';
import { clientLogger } from '@/shared/logger/client-logger';

/**
 * 公开页语言切换控件：换语言 URL，不是 `router.refresh()`。
 *
 * 每个语言都是真实链接（带 `hrefLang`），因此各语言 URL 对爬虫可发现；点击时顺带 best-effort 写
 * locale cookie，只用于「公开页 → 非公开页」交接时不跳语言（URL 仍是公开页语言的唯一权威）。
 *
 * 使用 `useSearchParams()`，因此调用方必须用 `Suspense` 包裹。
 *
 * @returns 语言链接组。
 */
export function PublicLocaleSwitcher() {
  const t = useTranslations('localeSwitcher');
  const currentLocale = toLocaleCode(useLocale());
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const query = searchParams.toString();
  const search = query ? `?${query}` : '';

  /**
   * 同步公开页语言到 locale cookie，供非公开页接续。失败不阻塞导航，只记受控日志。
   *
   * @param nextLocale - 即将进入的目标语言。
   */
  function syncLocaleCookie(nextLocale: LocaleCode): void {
    startTransition(() => {
      void setLocaleAction(nextLocale)
        .then((result) => {
          if (!result.ok) {
            clientLogger.warn('public locale cookie rejected', { fields: { nextLocale } });
          }
        })
        .catch((error: unknown) => {
          clientLogger.warn('public locale cookie failed', {
            fields: { message: error instanceof Error ? error.message : String(error), nextLocale },
          });
        });
    });
  }

  return (
    <Stack
      component="nav"
      direction="row"
      spacing={1.5}
      aria-label={t('label')}
      aria-busy={isPending}
      sx={{ alignItems: 'center' }}
    >
      {SUPPORTED_LOCALES.map((locale) => {
        const isCurrent = locale === currentLocale;

        return (
          <Link
            key={locale}
            href={`${swapPathLocale(pathname, locale)}${search}`}
            hrefLang={locale}
            aria-current={isCurrent ? 'true' : undefined}
            onClick={() => {
              if (!isCurrent) {
                syncLocaleCookie(locale);
              }
            }}
          >
            <Typography component="span" variant="body2" color={isCurrent ? 'text.primary' : 'primary'}>
              {locale === 'en-US' ? t('english') : t('chinese')}
            </Typography>
          </Link>
        );
      })}
    </Stack>
  );
}
