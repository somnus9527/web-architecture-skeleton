import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { ShowcasePanel } from './showcase-panel';

import type { IShowcaseListViewModel } from '@/bff/adapter/showcase-adapter';
import { PublicLocaleSwitcher } from '@/features/locale-switcher/public-locale-switcher';
import { ThemeToggleClient } from '@/features/theme/theme-toggle';

/**
 * showcase 首页编排层（Server Component）。保留服务端职责（文案/结构），
 * 把交互渲染下沉到 Client 叶子 `ShowcasePanel`。
 *
 * @param props - 已适配的展示模型。
 * @returns 首页主内容区。
 */
export async function ShowcasePage({ model }: { model: IShowcaseListViewModel }) {
  const t = await getTranslations('showcase');

  return (
    <main className="public-page public-page--wide">
      {/* 标题区提供公开页语言切换（换 URL）；控件用 useSearchParams，必须包 Suspense。 */}
      <div className="public-page__header">
        <div>
          <h1 className="public-page__title">{t('title')}</h1>
          <p className="public-page__subtitle">{t('subtitle')}</p>
        </div>
        <div className="public-page__actions">
          <ThemeToggleClient />
          <Suspense fallback={null}>
            <PublicLocaleSwitcher />
          </Suspense>
        </div>
      </div>
      <div className="public-page__body">
        <ShowcasePanel items={model.items} isEmpty={model.isEmpty} />
      </div>
    </main>
  );
}
