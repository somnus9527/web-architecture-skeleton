import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useThemeTokens } from '@theme/theme-provider';

import { AppText } from './app-text';

/**
 * 空态 / 错误态的上下文类型。
 */
export type EmptyStateContext = 'form' | 'detail' | 'list' | 'error';

interface IEmptyStateProps {
  /** 标题文案，必须由调用方提供 i18n 结果。 */
  title: string;
  /** 说明文案。 */
  description?: string;
  /** 上下文类型，决定强调色，默认 list。 */
  context?: EmptyStateContext;
  /** 操作区（如重试按钮）。 */
  action?: ReactNode;
  /** 额外布局样式，例如在整页空态中撑满高度。 */
  style?: StyleProp<ViewStyle>;
  /** 测试标识。 */
  testID?: string;
}

/**
 * 空态 / 错误态 primitive：统一标题、说明与操作区布局。
 *
 * @param props - 空态属性。
 * @returns 空态节点。
 */
export function EmptyState(props: IEmptyStateProps) {
  const { title, description, context = 'list', action, style, testID } = props;
  const tokens = useThemeTokens();

  const tone = context === 'error' ? 'danger' : 'primary';

  return (
    <View
      accessibilityRole="summary"
      style={[styles.container, { gap: tokens.spacing.sm, padding: tokens.spacing.xl }, style]}
      testID={testID}
    >
      <AppText numberOfLines={2} style={styles.centered} tone={tone} variant="title" weight="semibold">
        {title}
      </AppText>
      {description ? (
        <AppText numberOfLines={3} style={styles.centered} tone="muted" variant="body">
          {description}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
