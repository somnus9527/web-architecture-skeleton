'use client';

import { useTranslations } from 'next-intl';

import type { IShowcaseItemViewModel } from '@/bff/adapter/showcase-adapter';
import { EmptyState, StatusPill } from '@/shared/ui';

/**
 * showcase 列表 Client 叶子。仅消费已序列化的 view model props，
 * 不 import 任何 `@/bff` 运行时（类型除外）。
 *
 * @param props - 展示条目与空态标记。
 * @returns 列表 UI。
 */
export function ShowcasePanel({ items, isEmpty }: { items: IShowcaseItemViewModel[]; isEmpty: boolean }) {
  const t = useTranslations('showcase');

  if (isEmpty) {
    return <EmptyState title={t('empty')} />;
  }

  return (
    <div className="showcase-list">
      {items.map((item) => (
        <article className="showcase-card" key={item.id}>
          <div className="showcase-card__header">
            <h2 className="showcase-card__title">{item.title}</h2>
            <StatusPill tone="info">{item.category}</StatusPill>
          </div>
          <p className="showcase-card__summary">{item.summary}</p>
          <span className="showcase-card__time">{item.updatedLabel}</span>
        </article>
      ))}
    </div>
  );
}
