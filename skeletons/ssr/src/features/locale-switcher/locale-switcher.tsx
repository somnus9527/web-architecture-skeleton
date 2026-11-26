'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';

import { setLocaleAction } from '@/bff/actions/locale-actions';
import { SUPPORTED_LOCALES } from '@/i18n/locale-config';
import { clientLogger } from '@/shared/logger/client-logger';
import { Select } from '@/shared/ui';

/**
 * 语言切换控件。写 cookie 后 `router.refresh()` 局部刷新（不改路由、不整页 reload）。
 *
 * @returns 语言下拉。
 */
export function LocaleSwitcher() {
  const t = useTranslations('localeSwitcher');
  const currentLocale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  /**
   * 执行语言切换并刷新当前 RSC 树；失败时保留当前语言并记录受控日志。
   *
   * @param nextLocale - 用户选择的目标 locale。
   */
  async function applyLocale(nextLocale: string): Promise<void> {
    try {
      const result = await setLocaleAction(nextLocale);
      if (!result.ok) {
        clientLogger.warn('locale switch rejected', { fields: { nextLocale } });
        return;
      }

      router.refresh();
    } catch (error) {
      clientLogger.error('locale switch failed', {
        fields: { message: error instanceof Error ? error.message : String(error), nextLocale },
      });
    }
  }

  /**
   * 将语言切换标记为非阻塞更新，避免刷新 RSC 树期间冻结当前控件。
   *
   * @param nextLocale - 用户选择的目标 locale。
   */
  function handleChange(nextLocale: string): void {
    startTransition(() => {
      void applyLocale(nextLocale);
    });
  }

  return (
    <Select
      className="locale-switcher"
      size="small"
      aria-label={t('label')}
      value={currentLocale}
      disabled={isPending}
      onChange={handleChange}
      options={SUPPORTED_LOCALES.map((locale) => ({
        value: locale,
        label: locale === 'en-US' ? t('english') : t('chinese'),
      }))}
    />
  );
}
