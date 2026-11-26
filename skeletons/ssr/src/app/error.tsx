'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/shared/ui';

/**
 * 路由段错误边界。仅提供恢复入口，不暴露堆栈（引导用 request id 排查）。
 *
 * @param props - Next 注入的 reset 回调（error 对象故意不消费以免泄漏细节）。
 */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors.pages.routeUnavailable');

  return (
    <main className="error-page">
      <h1 className="error-page__title">{t('title')}</h1>
      <p className="error-page__description">{t('description')}</p>
      <Button onClick={reset}>{t('retry')}</Button>
    </main>
  );
}
