'use client';

import { useTranslations } from 'next-intl';

import { ThemeToggle } from '@/shared/ui';

/**
 * 公开页与非公开页共用的主题切换：把 i18n 文案接进 shared 组件，避免 shared 层依赖 locale。
 *
 * @returns 主题切换按钮。
 */
export function ThemeToggleClient() {
  const t = useTranslations('theme');

  return <ThemeToggle label={t('toggle')} />;
}
