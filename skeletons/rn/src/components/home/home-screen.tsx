import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import type { ListRenderItemInfo } from 'react-native';

import { AppText } from '@components/ui/app-text';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { EmptyState } from '@components/ui/empty-state';
import {
  LOW_END_FLAT_LIST_BATCHING_PERIOD_MS,
  LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT,
  LOW_END_FLAT_LIST_MAX_BATCH_COUNT,
  LOW_END_FLAT_LIST_WINDOW_SIZE,
} from '@components/ui/flat-list-performance';
import { Screen } from '@components/ui/screen';
import { SectionHeader } from '@components/ui/section-header';
import type { IHomeSummaryItem } from '@domain/contracts/home';
import { useThemeTokens } from '@theme/theme-provider';

import { useHomeSummary } from './use-home-summary';

/**
 * 状态枚举到 i18n key 的映射。
 */
const HOME_STATUS_LABEL_KEYS = {
  pending: 'home.status.pending',
  active: 'home.status.active',
  done: 'home.status.done',
} as const;

interface IHomeSummaryRowProps {
  /** 摘要条目。 */
  item: IHomeSummaryItem;
}

/**
 * 单条摘要卡片；memo 包裹避免父组件 re-render 触发整列重绘。
 *
 * @param props - 条目属性。
 * @returns 摘要卡片。
 */
const HomeSummaryRow = memo(function HomeSummaryRow({ item }: IHomeSummaryRowProps) {
  const { t } = useTranslation();
  const tokens = useThemeTokens();

  return (
    <Card>
      <View style={{ gap: tokens.spacing.xs }}>
        <AppText numberOfLines={2} tone="primary" variant="body" weight="medium">
          {item.title}
        </AppText>
        <AppText tone="muted" variant="caption">
          {t(HOME_STATUS_LABEL_KEYS[item.status])}
        </AppText>
      </View>
    </Card>
  );
});

/**
 * 列表 key 提取器，定义在组件外保证引用稳定。
 *
 * @param item - 摘要条目。
 * @returns 条目 id。
 */
function keyExtractor(item: IHomeSummaryItem): string {
  return item.id;
}

/**
 * 列表 renderItem，定义在组件外保证引用稳定。
 *
 * @param info - FlatList 渲染信息。
 * @returns 摘要卡片。
 */
function renderHomeSummaryRow({ item }: ListRenderItemInfo<IHomeSummaryItem>) {
  return <HomeSummaryRow item={item} />;
}

/**
 * 工作台首页：loading / error / empty 三态渲染 + 虚拟化列表。
 *
 * @returns 首页节点。
 */
export function HomeScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, isFetching, refetch } = useHomeSummary();
  const tokens = useThemeTokens();

  if (isPending) {
    return (
      <Screen testID="home-summary-loading">
        <View style={[styles.center, { gap: tokens.spacing.sm }]}>
          <ActivityIndicator color={tokens.colors.brandPrimary} />
          <AppText tone="muted">{t('home.loading')}</AppText>
        </View>
      </Screen>
    );
  }

  if (isError || !data) {
    return (
      <Screen>
        <EmptyState
          action={
            <Button
              label={t('home.retry')}
              loading={isFetching}
              onPress={() => void refetch()}
              testID="home-summary-retry"
              variant="secondary"
            />
          }
          context="error"
          style={styles.fill}
          testID="home-summary-error"
          title={t('home.error')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={[styles.list, { gap: tokens.spacing.sm, padding: tokens.spacing.md }]}
        data={data.items}
        initialNumToRender={LOW_END_FLAT_LIST_INITIAL_RENDER_COUNT}
        keyExtractor={keyExtractor}
        ListEmptyComponent={<EmptyState context="list" testID="home-summary-empty" title={t('home.empty')} />}
        ListHeaderComponent={<SectionHeader title={data.title} />}
        maxToRenderPerBatch={LOW_END_FLAT_LIST_MAX_BATCH_COUNT}
        removeClippedSubviews
        renderItem={renderHomeSummaryRow}
        testID="home-summary-list"
        updateCellsBatchingPeriod={LOW_END_FLAT_LIST_BATCHING_PERIOD_MS}
        windowSize={LOW_END_FLAT_LIST_WINDOW_SIZE}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
  },
});
