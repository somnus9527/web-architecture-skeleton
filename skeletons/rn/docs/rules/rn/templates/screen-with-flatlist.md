# FlatList Screen Template

> 上级规则：`docs/rules/rn/ui-components.md`、`docs/rules/rn/performance.md`、`docs/rules/rn/error-handling.md`、`docs/rules/rn/frontend.md`。

## Screen

```tsx
// src/components/<feature>/feature-list-screen.tsx
import { useCallback } from 'react';
import { FlatList, type ListRenderItemInfo, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@components/ui/empty-state';
import {
  LOW_END_FLAT_LIST_BATCHING_PERIOD_MS,
  LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT,
  LOW_END_FLAT_LIST_MAX_BATCH_COUNT,
  LOW_END_FLAT_LIST_WINDOW_SIZE,
} from '@components/ui/flat-list-performance';
import { SectionHeader } from '@components/ui/section-header';
import { Skeleton } from '@components/ui/skeleton';
import { useItemsQuery } from './use-items-query';
import { FeatureListItemCard, type IFeatureListItem } from './feature-list-item-card';

function keyExtractor(item: IFeatureListItem): string {
  return item.id;
}

export function FeatureListScreen() {
  const { t } = useTranslation();
  const query = useItemsQuery();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<IFeatureListItem>) => <FeatureListItemCard item={item} />,
    [],
  );

  if (query.isLoading) {
    return <Skeleton testID="feature-list-loading" />;
  }

  if (query.isError) {
    return (
      <EmptyState
        context="error"
        title={t('feature.error.title')}
        description={t('feature.error.description')}
        actionLabel={t('common.retry')}
        onAction={() => query.refetch()}
        testID="feature-list-error"
      />
    );
  }

  return (
    <FlatList
      data={query.data?.items ?? []}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT}
      maxToRenderPerBatch={LOW_END_FLAT_LIST_MAX_BATCH_COUNT}
      updateCellsBatchingPeriod={LOW_END_FLAT_LIST_BATCHING_PERIOD_MS}
      windowSize={LOW_END_FLAT_LIST_WINDOW_SIZE}
      removeClippedSubviews
      ListHeaderComponent={<SectionHeader title={t('feature.title')} description={t('feature.description')} />}
      ListEmptyComponent={
        <EmptyState
          context="list"
          title={t('feature.empty.title')}
          description={t('feature.empty.description')}
          testID="feature-list-empty"
        />
      }
      contentContainerStyle={styles.content}
      testID="feature-list"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
```

## Item Card

```tsx
// src/components/<feature>/feature-list-item-card.tsx
import React from 'react';
import { Text } from 'react-native';
import { Card } from '@components/ui/card';

export interface IFeatureListItem {
  id: string;
  title: string;
  description?: string;
}

interface IFeatureListItemCardProps {
  item: IFeatureListItem;
}

function FeatureListItemCardImpl({ item }: IFeatureListItemCardProps) {
  return (
    <Card accessibilityRole="button" accessibilityLabel={item.title}>
      <Text>{item.title}</Text>
      {item.description ? <Text>{item.description}</Text> : null}
    </Card>
  );
}

export const FeatureListItemCard = React.memo(FeatureListItemCardImpl);
```

## 测试要点

- loading / error / empty / success 四个分支。
- `renderItem` / `keyExtractor` 引用稳定。
- `FlatList` 使用低端设备预算常量。
